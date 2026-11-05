#!/usr/bin/env node
// 產生可被 Google 收錄的靜態頁 + sitemap.xml（不需要安裝任何套件，Node 18 以上）
//
//   node tools/generate-pages.mjs             只產生主題頁（food/、lottery/ ...，內容在 tools/themes.json）
//   node tools/generate-pages.mjs --popular   另外從 Firestore 抓公開的熱門轉盤，產生 r/<id>/
//
// 每一頁都是用 index.html 當模板，替換 <!-- page:head -->、<!-- page:intro -->、<!-- page:preset --> 三個區塊，
// 所以改了 index.html 之後重新執行一次，所有頁面就會一起更新。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://z358z358.github.io/Roulette/';
const FIRESTORE = 'https://firestore.googleapis.com/v1/projects/z358z358-roulette/databases/(default)/documents';
// 網頁版 Firebase 金鑰，本來就公開在 src/scripts/my.js；只能讀到公開轉盤（受 Firestore 規則限制）
const API_KEY = 'AIzaSyAtoSqn428jHyekJoMuhPXYJeWQtH8O6Mk';

const POPULAR_LIMIT = 60;      // 每次最多收錄幾個熱門轉盤
const MIN_OPTIONS = 3;         // 選項太少的轉盤內容太薄，不產生頁面
const RELATED_LINKS = 12;      // 每頁底下列出幾個其他熱門轉盤
const MAX_TABLE_ROWS = 100;    // 選項表最多列幾行

const withPopular = process.argv.includes('--popular');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const template = read('index.html');
const themes = JSON.parse(read('tools/themes.json'));
const blocklist = JSON.parse(read('tools/blocklist.json'));

// ---------- 小工具 ----------
const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const safeJson = (obj) => JSON.stringify(obj)
    .replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16));

function replaceBlock(html, name, content) {
    const re = new RegExp(`<!-- page:${name} -->[\\s\\S]*?<!-- /page:${name} -->`);
    if (!re.test(html)) throw new Error(`index.html 裡找不到 <!-- page:${name} --> 區塊`);
    return html.replace(re, () => content);
}

// 子資料夾的頁面要把相對路徑往上一層（asset/、dist/、首頁連結）
function relocate(html, prefix) {
    return html
        .replace(/(href|src)="(asset\/|dist\/)/g, `$1="${prefix}$2`)
        .replace(/href="\."/g, `href="${prefix}"`);
}

function percent(weight, sum) {
    const p = (weight / sum) * 100;
    if (p > 0 && p < 0.01) return '<0.01%';
    return (p >= 10 ? p.toFixed(1) : p.toFixed(2)).replace(/\.?0+$/, '') + '%';
}

function optionTable(options) {
    const sum = options.reduce((a, o) => a + o.weight, 0);
    const rows = options.slice(0, MAX_TABLE_ROWS)
        .map((o) => `<tr><td>${esc(o.name)}</td><td>${esc(percent(o.weight, sum))}</td></tr>`)
        .join('\n                    ');
    const more = options.length > MAX_TABLE_ROWS
        ? `\n            <p>…共 ${options.length} 個選項，完整內容請直接轉上方的轉盤。</p>` : '';
    return `<table class="table table-condensed table-striped option-table">
                <thead><tr><th>選項</th><th>機率</th></tr></thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>${more}`;
}

// ---------- 熱門轉盤頁的清單（r/<id>/ 資料夾 + r/pages.json 依人氣排序） ----------
const rDir = path.join(ROOT, 'r');
const manifestPath = path.join(rDir, 'pages.json');
const existingIds = () => (fs.existsSync(rDir)
    ? fs.readdirSync(rDir).filter((d) => fs.existsSync(path.join(rDir, d, 'index.html'))).sort()
    : []);
function readManifest() {
    let list = [];
    try { list = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { /* 第一次執行還沒有 */ }
    const ids = new Set(existingIds());
    return list.filter((p) => ids.has(p.id));
}
const HOME_POPULAR = 12;       // 首頁「熱門轉盤」區塊顯示幾個
let hasPopularPages = existingIds().length > 0 || withPopular;

function themeLinks(prefix, exceptSlug) {
    const items = themes
        .filter((t) => t.slug !== exceptSlug)
        .map((t) => `<li><a href="${prefix}${t.slug}/">${esc(t.name)}</a></li>`);
    if (hasPopularPages) items.push(`<li><a href="${prefix}r/">熱門轉盤排行</a></li>`);
    items.push(`<li><a href="${prefix}">自訂轉盤首頁</a></li>`);
    return `<ul class="theme-links">\n                ${items.join('\n                ')}\n            </ul>`;
}

function headBlock({ title, description, url }) {
    return `<title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${url}" />
    <meta property="og:locale" content="zh_TW" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${SITE}asset/200x200.jpg" />`;
}

function buildPage({ prefix, head, intro, preset }) {
    let html = template;
    html = replaceBlock(html, 'head', head);
    html = replaceBlock(html, 'intro', intro);
    html = replaceBlock(html, 'preset', `<script>window.ROULETTE_PRESET = ${safeJson(preset)};</script>`);
    return relocate(html, prefix);
}

function writePage(dir, html) {
    fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
    fs.writeFileSync(path.join(ROOT, dir, 'index.html'), html);
}

// ---------- 主題頁 ----------
for (const t of themes) {
    const url = `${SITE}${t.slug}/`;
    const prefix = '../';
    const intro = `<section class="page-intro">
            <h1>${esc(t.h1)}</h1>
            <p class="lead">${esc(t.lead)}</p>
            <h2>預設選項與機率</h2>
            ${optionTable(t.options)}
            <h2>小技巧</h2>
            <ul>
                ${t.tips.map((s) => `<li>${esc(s)}</li>`).join('\n                ')}
            </ul>
            <h2>其他轉盤</h2>
            ${themeLinks(prefix, t.slug)}
        </section>`;
    writePage(t.slug, buildPage({
        prefix,
        head: headBlock({ title: t.seoTitle, description: t.description, url }),
        intro,
        preset: { id: `theme-${t.slug}`, url, title: t.name, options: t.options },
    }));
}
console.log(`主題頁：${themes.length} 頁`);

// ---------- 熱門轉盤頁（r/<id>/） ----------
function fromValue(v) {
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
    if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
    return null;
}
function fromFields(fields) {
    const o = {};
    for (const [k, v] of Object.entries(fields)) o[k] = fromValue(v);
    return o;
}
function toRoulette(doc) {
    const d = fromFields(doc.fields || {});
    const options = (Array.isArray(d.options) ? d.options : [])
        .filter((o) => o && String(o.name ?? '').trim() !== '' && Number(o.weight) > 0)
        .map((o) => ({ name: String(o.name).trim(), weight: Number(o.weight) }));
    return {
        id: doc.name.split('/').pop(),
        title: String(d.title || '').trim(),
        options,
        hot: Number(d.hot) || 0,
        isPrivate: d.isPrivate !== false,
    };
}

const keywords = blocklist.keywords.map((k) => k.toLowerCase());
function eligible(r) {
    if (r.isPrivate || r.title.length < 2 || r.options.length < MIN_OPTIONS) return false;
    if (blocklist.ids.includes(r.id)) return false;
    const text = (r.title + ' ' + r.options.map((o) => o.name).join(' ')).toLowerCase();
    return !keywords.some((k) => text.includes(k));
}

async function firestore(url, init, { missingOk = false } = {}) {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}key=${API_KEY}`, init);
    // 單筆讀取：404 = 已刪除；403 = 已改成不公開（規則擋掉）→ 都當成不存在
    if (missingOk && (res.status === 404 || res.status === 403)) return null;
    if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
    return res.json();
}

// Firestore 規則限制一次最多查 50 筆（跟網頁「熱門轉盤」一樣），所以用游標一頁一頁往下抓
const PAGE_SIZE = 50;
const MAX_PAGES = 4;

async function fetchPopular() {
    const picked = [];
    let cursor = null;
    for (let page = 0; page < MAX_PAGES && picked.length < POPULAR_LIMIT; page++) {
        const structuredQuery = {
            from: [{ collectionId: 'list' }],
            where: { fieldFilter: { field: { fieldPath: 'isPrivate' }, op: 'EQUAL', value: { booleanValue: false } } },
            orderBy: [
                { field: { fieldPath: 'hot' }, direction: 'DESCENDING' },
                { field: { fieldPath: '__name__' }, direction: 'DESCENDING' },
            ],
            limit: PAGE_SIZE,
        };
        if (cursor) structuredQuery.startAt = { values: [cursor.fields.hot, { referenceValue: cursor.name }], before: false };
        const rows = await firestore(`${FIRESTORE}:runQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ structuredQuery }),
        });
        const docs = rows.filter((r) => r.document).map((r) => r.document);
        for (const d of docs) {
            const r = toRoulette(d);
            if (eligible(r) && picked.length < POPULAR_LIMIT) picked.push(r);
        }
        if (docs.length < PAGE_SIZE) break;
        cursor = docs[docs.length - 1];
    }
    return picked;
}

function roulettePage(r, related) {
    const url = `${SITE}r/${r.id}/`;
    const prefix = '../../';
    const names = r.options.map((o) => clip(o.name, 20));
    const title = clip(r.title, 50);
    const description = clip(
        `「${title}」線上轉盤，選項有${names.slice(0, 6).join('、')}${names.length > 6 ? '等' : ''}共 ${r.options.length} 個。點一下就能轉，也能改成自己的版本再分享。`,
        160);
    const relatedItems = related
        .filter((x) => x.id !== r.id)
        .slice(0, RELATED_LINKS)
        .map((x) => `<li><a href="${prefix}r/${x.id}/">${esc(clip(x.title, 30))}</a></li>`);
    const intro = `<section class="page-intro">
            <h1>${esc(title)}</h1>
            <p class="lead">「${esc(title)}」是網友在自訂轉盤分享的轉盤，共 ${r.options.length} 個選項。點上方轉盤就能直接轉，也可以按「修改轉盤」改成自己的版本再存檔。</p>
            <h2>轉盤選項與機率</h2>
            ${optionTable(r.options)}
            <h2>其他熱門轉盤</h2>
            <ul class="theme-links">
                ${relatedItems.join('\n                ')}
            </ul>
            <p><a href="${prefix}r/">看全部熱門轉盤 →</a></p>
            <h2>常用轉盤</h2>
            ${themeLinks(prefix, null)}
        </section>`;
    return buildPage({
        prefix,
        head: headBlock({ title: `${title} - 自訂轉盤`, description, url }),
        intro,
        // options 是快照：轉盤之後被刪除時，頁面仍能用這份內容顯示
        preset: { id: `r-${r.id}`, rid: r.id, url, title: r.title, options: r.options },
    });
}

if (withPopular) {
    const popular = await fetchPopular();
    const keep = new Map(popular.map((r) => [r.id, r]));

    // 以前收錄過、這次不在熱門名單的：確認還公開、沒被檔掉才保留，否則刪除頁面
    let removed = 0;
    for (const id of existingIds()) {
        if (keep.has(id)) continue;
        const doc = await firestore(`${FIRESTORE}/list/${encodeURIComponent(id)}`, undefined, { missingOk: true });
        const r = doc && toRoulette(doc);
        if (r && eligible(r)) {
            keep.set(id, r);
        } else {
            fs.rmSync(path.join(rDir, id), { recursive: true, force: true });
            removed++;
        }
    }

    for (const r of keep.values()) writePage(path.join('r', r.id), roulettePage(r, popular));
    console.log(`熱門轉盤頁：${keep.size} 頁（本次熱門 ${popular.length}，移除 ${removed}）`);

    // 清單：依人氣排序，給總覽頁、首頁區塊、網頁的「熱門轉盤」清單使用
    const manifest = [...keep.values()]
        .sort((a, b) => b.hot - a.hot || a.id.localeCompare(b.id))
        .map((r) => ({ id: r.id, title: r.title, options: r.options.length, hot: r.hot }));
    fs.mkdirSync(rDir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
}

// ---------- 熱門轉盤總覽頁 r/ + 首頁區塊 ----------
const manifest = readManifest();
hasPopularPages = manifest.length > 0;

if (hasPopularPages) {
    const url = `${SITE}r/`;
    const prefix = '../';
    const items = manifest.map((p) =>
        `<li><a href="${p.id}/">${esc(clip(p.title, 40))}</a> <small class="text-muted">${p.options} 個選項</small></li>`);
    const intro = `<section class="page-intro">
            <h1>熱門轉盤排行</h1>
            <p class="lead">網友在自訂轉盤分享、最多人轉過的 ${manifest.length} 個轉盤，每週更新。點名稱就能直接轉，也可以改成自己的版本再存檔；不知道玩哪個，就轉上面的轉盤隨機挑一個。</p>
            <ol class="popular-list">
                ${items.join('\n                ')}
            </ol>
            <h2>常用轉盤</h2>
            ${themeLinks(prefix, null)}
        </section>`;
    writePage('r', buildPage({
        prefix,
        head: headBlock({
            title: '熱門轉盤排行｜網友最常用的轉盤 - 自訂轉盤',
            description: `自訂轉盤網友最常用的 ${manifest.length} 個轉盤排行：${manifest.slice(0, 5).map((p) => clip(p.title, 12)).join('、')}等，每週更新，點一下就能轉。`,
            url,
        }),
        intro,
        preset: {
            id: 'popular-index',
            url,
            title: '熱門轉盤隨機挑一個',
            // 8 個以內：每格超過 10%，轉盤上才會顯示文字
            options: manifest.slice(0, 8).map((p) => ({ name: clip(p.title, 10), weight: 1 })),
        },
    }));

    // 首頁 index.html 的 <!-- page:popular --> 區塊（其他頁面會整個換掉 page:intro，不受影響）
    const home = read('index.html');
    const block = `<!-- page:popular -->
            <ul class="theme-links">
                ${manifest.slice(0, HOME_POPULAR).map((p) => `<li><a href="r/${p.id}/">${esc(clip(p.title, 24))}</a></li>`).join('\n                ')}
            </ul>
            <!-- /page:popular -->`;
    const updated = replaceBlock(home, 'popular', block);
    if (updated !== home) fs.writeFileSync(path.join(ROOT, 'index.html'), updated);
    console.log(`熱門轉盤總覽頁：${manifest.length} 個，首頁區塊：${Math.min(HOME_POPULAR, manifest.length)} 個`);
}

// ---------- sitemap.xml ----------
const urls = [
    `    <url>
        <loc>${SITE}</loc>
        <xhtml:link rel="alternate" hreflang="zh-Hant" href="${SITE}" />
        <xhtml:link rel="alternate" hreflang="en" href="${SITE}?lang=en" />
        <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}" />
    </url>`,
    ...themes.map((t) => `    <url>\n        <loc>${SITE}${t.slug}/</loc>\n    </url>`),
    ...(hasPopularPages ? [`    <url>\n        <loc>${SITE}r/</loc>\n    </url>`] : []),
    ...existingIds().map((id) => `    <url>\n        <loc>${SITE}r/${id}/</loc>\n    </url>`),
];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`);
console.log(`sitemap.xml：${urls.length} 個網址`);
