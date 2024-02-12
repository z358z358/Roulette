var fire, db;
$.cookie.json = true;

var vue = new Vue({
    el: '#main',
    data: {
        set: {
            options: [],
            title: '',
            ts: 0,
            hot: 0,
            uid: '',
            isPrivate: false,
        },

        onlineSet: {},

        c: {
            setTurn: 1,
            duration: 3000,
            volume: true,
            targetTag: 'piechart',
            chatType: 'plot',
            angleType: 1,
        },

        s: {
            _url: 'http://z358z358.github.io/Roulette/',
            url: 'http://z358z358.github.io/Roulette/',
            text: $("meta[name='description']").attr('content'),
            title: $("title").text()
        },

        user: {
            provider: '',
            uid: '',
            displayName: '',
        },

        Msg: { type: '', msg: '' },

        cookieKey: 'z358z358-roulette',
        cookieKeyLang: 'z358z358-roulette-lang',
        hotKey: 'hot-cd',
        rid: '',
        turnFlag: -1,
        goFlag: false,
        targetUntil: { target: -1, count: 0, action: '' },
        saveType: '',
        angle: 0,
        target: 0,
        turn: 0,
        sum: 0,
        logs: [],
        list: [],
        max: 50,
        uploadReady: true,
        lang: i18nextDefaultLang,
        getOptions: {},
        copiedMsg: '',
        navigatorShare: false
    },

    // 為了讓v-repeat v-model v-on一起用
    components: {
        options: {
            watch: {
                on: function(v) {
                    vue.draw();
                }
            }
        }
    },

    watch: {
        // timeago
        logs: function(val, oldVal) {
            jQuery(".timeago").timeago();
        },

        // timeago
        list: function(val, oldVal) {
            jQuery(".timeago").timeago();
        },
        'c.chatType': 'draw',
        'c.targetTag': 'draw',
        'set.options': 'draw',
    },

    filters: {
        persent: function(number) {
            return parseFloat((number * 100).toFixed(3)) + '%';
        }
    },

    computed: {
        showHideBtn: function() {
            var r = true;
            if (this.logs.length) {
                var count = 0;
                var target = this.logs[0].target;
                var onTarget = null;
                this.set.options.map(function(option, t) {
                    if (option.on === false) return;
                    count++;
                    onTarget = t;
                });

                if (count <= 0) {
                    r = false;
                } else if (count == 1 && onTarget == target) {
                    r = false;
                }
            }

            return r;
        }
    },

    ready: function() {
        var url = new URL(window.location.href);
        var getLang = url.searchParams.get('lang');
        if (getLang) {
            this.changeLang(getLang, 'getLang');
            window.location.href = this.s.url;
            return;
        }

        var lang = $.cookie(this.cookieKeyLang);
        if (lang) {
            this.changeLang(lang, 'cookie');
        }

        var c = $.cookie(this.cookieKey);
        if (c && Object.keys(this.c).length == Object.keys(c).length) {
            this.c = c;
        } else {
            $('.first-intro').tooltip('show');
            setTimeout(function() { $('.first-intro').tooltip('hide'); }, 3000);
        }
        this.setOptionOn();
        this.sendGa('網址', window.location.href);

        if (navigator.share) {
            this.navigatorShare = true;
        }
    },

    methods: {
        draw: function() {
            this.getSum();
            if (this.sum == 0) {
                return;
            }
            if (this.c.chatType == 'plot') {
                this.drawByPlot();
            } else {
                this.drawByGoole();
            }
            $("#piechart,#lotteryBtn").css('transform', 'rotate(0)');
            this.saveConfig();
        },
        // google chart
        drawByGoole: function() {
            var tmp = [
                [i18next.t('js.j6'), i18next.t('js.j7')]
            ];
            this.set.options.map(function(option) {
                if (option.on === false) return;
                var weight = parseFloat(option.weight, 10);
                tmp.push([option.name, weight]);
            });

            if (typeof google == 'undefined' || typeof google.visualization == 'undefined' || typeof google.visualization.arrayToDataTable != 'function') {
                return false;
            }

            var data = google.visualization.arrayToDataTable(tmp);

            var options = {
                pieSliceText: 'label',
                title: this.set.title,
                pieHole: 0.3,
                legend: { alignment: 'center', 'position': 'bottom' }
                //slices: offset,
            };
            var chart = new google.visualization.PieChart(document.getElementById('piechart'));
            chart.draw(data, options);
        },

        drawByPlot: function() {
            var data = [];
            this.set.options.map(function(option) {
                if (option.on === false) return;
                var weight = parseFloat(option.weight, 10);
                data.push({ data: weight, label: option.name });
            });

            $.plot('#piechart', data, {
                series: {
                    pie: {
                        show: true,
                        radius: 1,
                        label: {
                            show: true,
                            radius: 2 / 3,
                            formatter: labelFormatter,
                            threshold: 0.1
                        }
                    }
                },
                legend: {
                    show: false
                }
            });
        },

        addOption: function() {
            this.sendGa('點擊按鈕', '新增選項');
            this.set.options.unshift({ name: '', weight: 1, on: true });
            this.$nextTick(function() {
                $("#option-table input:first").focus();
            })
        },

        removeOption: function(option) {
            this.sendGa('點擊按鈕', '刪除選項');
            this.set.options.$remove(option.$data);
        },

        copyOption: function(option, key) {
            this.sendGa('點擊按鈕', '複製選項');
            var newOption = _.clone(option.$data);
            this.set.options.splice(key, 0, newOption);
        },

        getRandomArbitrary: function(min, max) {
            return Math.random() * (max - min) + min;
        },

        go: function(type, index) {
            var options = this.set.options;
            var oldAngle = this.angle;
            var tmp = 0;
            var moreAngle = 1800;
            this.getSum();
            var addAngle = this.getRandomArbitrary(0, this.sum);
            // console.log(addAngle);
            //return ;

            if (this.goFlag == true || this.sum == 0) {
                return;
            }

            if (type == 'c') {
                this.turnFlag = this.c.setTurn;
                this.saveConfig();
            } else if (type == 'option') {
                if (options[index].on === false) {
                    return;
                }
                this.sendGa('點擊按鈕', '血統模式開始');
                this.targetUntil.target = index;
                this.targetUntil.count = 0;
                this.targetUntil.action = 'run';
                this.saveConfig();
            }

            //console.log(addAngle);
            for (var i = 0; i <= options.length - 1; i++) {
                if (options[i].on === false) continue;
                tmp += options[i].weight;
                //console.log(tmp,i,options[i].weight / sum);
                if (tmp > addAngle) {
                    this.target = i;
                    var targetAngle = 0;
                    var nextStart = Math.floor(tmp / this.sum * 360);
                    if (options[i - 1]) {
                        var targetAngle = Math.floor((tmp - options[i].weight) / this.sum * 360);
                    }
                    console.log(targetAngle, nextStart);
                    addAngle = targetAngle + this.getRandomArbitrary(0, nextStart - targetAngle);
                    break;
                }
                //tmp += options[i].weight;
            };

            if (this.c.chatType == 'google') {
                this.c.targetTag = 'lotteryBtn';
            }

            if (this.c.targetTag == 'piechart') {
                addAngle = 360 - addAngle;
            }

            if (this.c.angleType == -1) {
                moreAngle *= -1;
                addAngle = addAngle - 360;
            }

            this.goFlag = true;
            this.angle = addAngle;
            if (this.c.volume) document.getElementById("sound").play();
            $("#" + this.c.targetTag).rotate({
                angle: oldAngle,
                duration: this.c.duration,
                animateTo: addAngle + moreAngle,
                callback: this.goDone,
            });
        },

        goDone: function() {
            var a = {};
            var log = {};
            var times = (parseInt(this.set.options[this.target].times) || 0) + 1;
            this.goFlag = false;
            this.turn = this.turn + 1;

            log.ts = new Date().getTime();
            log.target = this.target;
            log.content = this.set.options[this.target].name;
            this.logs.unshift(log);
            if (this.logs.length > 1000) {
                this.logs.pop();
            }

            if (this.c.targetTag == 'piechart') {
                $("#piechart .pieLabel").css('transform', 'rotate(' + (360 - this.angle) + 'deg)');
            }

            this.set.options[log.target].$set('times', times);
            if (this.turnFlag >= 1) {
                this.turnFlag--;
                if (this.turnFlag >= 1) {
                    this.go();
                }
            } else if (this.targetUntil.action == 'run') {
                this.targetUntil.count++;
                if (this.targetUntil.target !== this.target) {
                    this.go();
                } else {
                    this.targetUntil.action = 'end';
                    this.$nextTick(function() {
                        $('[data-i18n]').localize();
                    });
                    // this.targetUntil.target = -1;
                }
            } else {
                // this.$nextTick(function() {
                //     $('[data-i18n]').localize();
                // });
                this.saveConfig();
                if (this.c.volume) document.getElementById("end").play();
            }
        },

        saveOnFireBase: function() {
            var that = this;
            var tmp = $.extend({}, this.set);
            var tmp2;

            for (var i = tmp.options.length - 1; i >= 0; i--) {
                delete tmp.options[i].times;
                delete tmp.options[i].on;
            };
            delete tmp.hot;

            if (tmp.uid && tmp.uid === this.user.uid && this.rid && this.saveType == 'save') {
                tmp.ts = new Date().getTime();
                db.collection("list").doc(this.rid).set(tmp).then(function() {
                        that.$set('Msg', { type: 'success', msg: i18next.t('js.j9') });
                    })
                    .catch(function(error) {
                        console.error("Error writing document: ", error);
                        that.$set('Msg', { type: 'error', msg: i18next.t('js.j8') });
                    });
            } else {
                this.set.uid = tmp.uid = this.user.uid;
                //console.log('新增');
                if (this.onlineSet.title) {
                    var optionsEq = true;
                    delete this.onlineSet.ts;
                    delete this.onlineSet.hot;
                    delete tmp.ts;
                    // console.log(_.isEqual(tmp, this.onlineSet), tmp, this.onlineSet);

                    for (var i = tmp.options.length - 1; i >= 0; i--) {
                        //console.log(_.isEqual(tmp.options[i], this.onlineSet.options[i]), tmp.options[i], this.onlineSet.options[i]);
                        if (_.isEqual(tmp.options[i], this.onlineSet.options[i]) == false) {
                            optionsEq = false;
                            break;
                        }
                    }

                    //console.log(_.isEqual(tmp, this.onlineSet), optionsEq);
                    if (_.isEqual(tmp, this.onlineSet) && optionsEq) {
                        console.error("重複儲存" + tmp.title);
                        this.sendGa('重複儲存', tmp.title);
                        return false;
                    }
                }
                tmp.ts = new Date().getTime();
                tmp.hot = 0;
                db.collection("list").add(tmp)
                    .then(function(docRef) {
                        that.onlineSet = _.cloneDeep(tmp);
                        that.rid = window.location.hash = docRef.id;
                        that.$set('Msg', { type: 'success', msg: i18next.t('js.j11') });
                    })
                    .catch(function(error) {
                        console.error("Error adding document: ", error);
                        that.$set('Msg', { type: 'error', msg: i18next.t('js.j10') });
                    });
            }

            this.sendGa('點擊按鈕', '儲存轉盤');

            this.draw();
        },

        getList: function(type) {
            var that = this;
            var title = (type == 'hot') ? i18next.t('js.j12') : i18next.t('js.j17');
            var tmp = db.collection("list");
            var order = (type == 'my') ? 'ts' : type;

            title = (type == 'my') ? i18next.t('js.j13') : title;
            if (type != 'my') {
                this.$set('list', []);
            }

            this.$set('listOrder', order);
            this.$set('listType', type);
            this.$set('listTitle', title);

            if (type == 'my' && this.user.uid) {
                tmp = tmp.where('uid', '==', this.user.uid).orderBy('ts', 'desc');
            } else {
                tmp = tmp.where('isPrivate', '==', false).orderBy(type, 'desc');
            }

            var allCount = 0;
            var count = 0;
            tmp.limit(that.max).get().then(function(querySnapshot) {
                var listArray = []
                querySnapshot.forEach(function(doc) {
                    var a = doc.data();
                    a.id = doc.id;

                    listArray.push(a);
                    // console.log(doc.id, doc.data());
                });
                that.list = listArray;

                $('[data-i18n]').localize();
            }).catch(function(error) {
                console.log("Error getting document:", error);
            });;

            this.sendGa('取得list', type);

        },

        loadOption: function(id) {
            var that = this;
            var docRef = db.collection("list").doc(id);
            docRef.get(this.getOptions).then(function(doc) {
                that.setOptions(doc);
                $("#list-modal").modal('hide');
                $(".navbar-toggle:not(.collapsed)").click();
                window.location.hash = id;
            }).catch(function(error) {
                console.log("Error getting cached document:", error);
            });
        },

        setOptions: function(doc) {
            var oldRid = this.rid;
            if (doc.exists === false) {
                this.rid = '';
                this.loadDefaultOption();
                this.draw();
                return;
            }

            var tmp = doc.data();
            var title = tmp.title + i18next.t('js.j15');
            this.set = tmp;
            this.onlineSet = _.cloneDeep(tmp);
            $("title").text(title);
            this.sendGa('讀取option', tmp.title);
            this.s.title = title;

            this.setOptionOn();
            this.draw();

            this.rid = doc.id;
            this.s.url = this.s._url + '#' + this.rid;

            if (!$.cookie(this.hotKey)) {
                $.cookie(this.hotKey, '1', { path: '/', expires: 1 });
                this.incHot(doc.id);
            }

            this.$nextTick(function() {
                if (typeof FB !== 'undefined') {
                    FB.XFBML.parse();
                }
            });
        },

        // 人氣+1
        incHot: function(id) {
            var that = this;
            var sfDocRef = db.collection("list").doc(id);
            db.runTransaction(function(transaction) {
                // This code may get re-run multiple times if there are conflicts.
                return transaction.get(sfDocRef).then(function(sfDoc) {
                    if (!sfDoc.exists) {
                        throw "Document does not exist!";
                    }

                    var hot = sfDoc.data().hot ? sfDoc.data().hot : 0;
                    hot++;
                    transaction.update(sfDocRef, { hot: hot });
                });
            }).then(function() {
                that.sendGa('人氣inc', that.s.title);
            }).catch(function(error) {
                console.log("Transaction failed: ", error);
            });
        },

        login: function(type) {
            var that = this;
            if (type == 'logout') {
                this.sendGa('登出');
                firebase.auth().signOut().then(function() {
                    that.$set('user', { uid: '', provider: '', displayName: '' });
                }, function(error) {
                    // An error happened.
                });
            } else {
                this.sendGa('登入', type);
                if (type == 'facebook') {
                    var provider = new firebase.auth.FacebookAuthProvider();
                } else if (type == 'google') {
                    var provider = new firebase.auth.GoogleAuthProvider();
                } else if (type == 'yahoo') {
                    var provider = new firebase.auth.OAuthProvider('yahoo.com');
                }
                firebase.auth().signInWithPopup(provider).then(function(result) {
                    // This gives you a Facebook Access Token. You can use it to access the Facebook API.
                    var token = result.credential.accessToken;
                    // The signed-in user info.
                    var user = result.user;
                    that.loginBack(user);
                    // ...
                }).catch(function(error) {
                    console.log(error);
                    // Handle Errors ere.
                    var errorCode = error.code;
                    var errorMessage = error.message;
                    // The email of the user's account used.
                    var email = error.email;
                    // The firebase.auth.AuthCredential type that was used.
                    var credential = error.credential;
                    // ...
                });
            }
        },

        loginBack: function(authData) {
            //console.log("Authenticated successfully with payload:", authData , that);
            this.user.uid = authData.uid;
            this.user.displayName = authData.providerData[0].displayName;
            //console.log(authData.providerData);
            $(".navbar-toggle:not(.collapsed)").click();
        },

        deleteLog: function(type) {
            if (type == 'all') {
                this.$set('logs', []);
                this.set.options.map(function(option) {
                    option.$set('times', 0);
                });
                this.turn = 0;
            }
        },

        setVolume: function(value) {
            this.c.$set('volume', value);
            this.saveConfig();

            this.sendGa('聲音', value);
        },

        showIntro: function() {
            this.sendGa('介紹');
            var options = webLangCustom[this.lang].translation.introOption;
            introJs().setOptions(options).start();
        },

        // firebase斷線  官方說1連接大概是1000瀏覽次數/月，所以50連接限制大概要每個月50K瀏覽才會到
        // 應該不會破表 暫時不用
        goOffline: function() {
            Firebase.goOffline();
        },

        goOnline: function() {
            Firebase.goOnline();
        },

        showDsq: function() {
            if (this.dsq) {
                return;
            }
            /* * * DON'T EDIT BELOW THIS LINE * * */
            (function() {
                var dsq = document.createElement('script');
                dsq.type = 'text/javascript';
                dsq.async = true;
                dsq.src = '//' + disqus_shortname + '.disqus.com/embed.js';
                (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(dsq);
            })();

            this.$set('dsq', true);

            this.sendGa('留言');
        },

        fireOn: function() {
            var that = this;
            if (window.location.hash) {
                this.rid = window.location.hash.substring(1); //Puts hash in variable, and removes the # character
                this.loadOption(this.rid);
            } else {
                this.loadDefaultOption();
                this.draw();
            }

            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {
                    that.loginBack(user);
                }
            });
        },

        getSum: function() {
            var sum = 0;
            this.set.options.map(function(option) {
                option.$set('weight', Math.abs(option.weight));
                if (option.on === false) return;
                sum += parseFloat(option.weight, 10);
            });
            this.sum = sum;
        },

        setOptionOn: function() {
            this.set.options.map(function(option) {
                option.$set('on', true);
            });
        },

        saveConfig: function() {
            $.cookie(this.cookieKey, this.c, { path: '/', expires: 365 });
        },

        deleteData: function(id) {
            var that = this;
            db.collection("list").doc(id).delete().then(function() {
                that.getList('my');

                that.sendGa('刪除轉盤', id);
            }).catch(function(error) {
                console.error("Error removing document: ", error);
            });
        },

        csvDownload: function() {
            var filename = this.set.title + i18next.t('js.j16');
            var rows = [
                [i18next.t('js.j6'), i18next.t('js.j7')]
            ];
            this.set.options.map(function(option) {
                var weight = parseFloat(option.weight, 10);
                rows.push([option.name, weight]);
            });

            var processRow = function(row) {
                var finalVal = '';
                for (var j = 0; j < row.length; j++) {
                    var innerValue = row[j] === null ? '' : row[j].toString();
                    if (row[j] instanceof Date) {
                        innerValue = row[j].toLocaleString();
                    };
                    var result = innerValue.replace(/"/g, '""');
                    if (result.search(/("|,|\n)/g) >= 0)
                        result = '"' + result + '"';
                    if (j > 0)
                        finalVal += ',';
                    finalVal += result;
                }
                return finalVal + '\n';
            };

            var csvFile = '';
            for (var i = 0; i < rows.length; i++) {
                csvFile += processRow(rows[i]);
            }

            var blob = new Blob(["\uFEFF" + csvFile], { type: 'text/csv;charset=utf-8;' });
            if (navigator.msSaveBlob) { // IE 10+
                navigator.msSaveBlob(blob, filename);
            } else {
                var link = document.createElement("a");
                if (link.download !== undefined) { // feature detection
                    // Browsers that support HTML5 download attribute
                    var url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", filename);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            }

            this.sendGa('csv', '下載');
        },

        csvUpload: function($event) {
            this.sendGa('csv', '上傳');

            var that = this;
            var files = $event.target.files;
            var reader = new FileReader();
            reader.onload = function(e) {
                var rows = [];
                var cval = e.target.result.split("\n");
                // console.log(cval);
                for (i in cval) {
                    if (i == 0) {
                        continue;
                    }
                    var data = cval[i].split(',').map(function(e) { return e.trim(); });
                    if (data.length == 2) {
                        var weight = parseFloat(data[1], 10);
                        rows.push({ name: data[0], weight: weight, on: true });
                    }
                }

                if (rows) {
                    that.set.$set('options', rows);
                }
            }

            reader.readAsText(files.item(0));
            this.uploadReady = false;
            this.$nextTick(function() {
                that.uploadReady = true;
            })
        },

        changeLang: function(lang, trigger) {
            if (trigger == 'nav') {
                this.sendGa('lang', lang);
            }
            var langs = ['tw', 'en'];
            if (langs.indexOf(lang) === -1) {
                return;
            }
            this.lang = lang;
            $.cookie(this.cookieKeyLang, lang, { path: '/', expires: 365 });
            i18next.changeLanguage(lang);
            afterChangeLang(lang);
        },

        sendGa: function(type, act, tag) {
            gtag('event', act, {
                'event_category': type,
                'event_label': tag
            });
        },

        loadDefaultOption: function() {
            this.set.options = [
                { name: i18next.t('js.j1'), weight: 1, on: true },
                { name: i18next.t('js.j2'), weight: 1, on: true },
                { name: i18next.t('js.j3'), weight: 1, on: true },
                { name: i18next.t('js.j4'), weight: 1, on: true },
            ];
            this.set.title = i18next.t('js.j5');
        },

        copyLink: function() {
            var that = this;
            copyStringToClipboard(this.s.url);
            this.copiedMsg = 'Copied';
            setTimeout(function() { that.copiedMsg = '' }, 3000);
            this.sendGa('點擊按鈕', '複製連結');
        },

        mobileShare: function() {
            const shareData = {
                title: this.s.title,
                text: this.s.title,
                url: this.s.url
            };
            navigator.share(shareData);

            this.sendGa('點擊按鈕', '手機分享');
        },

        toggleTarget: function(target) {
            this.set.options[target].on = !this.set.options[target].on;
        },

        deleteMyAccount: function(confirmed) {
            var that = this;
            if (confirmed || confirm(i18next.t('nav.deleteConfirm'))) {
                var tmp = db.collection("list").where('uid', '==', this.user.uid).orderBy('ts', 'desc');
                tmp.limit(that.max).get().then(function(querySnapshot) {
                    var count = 0;
                    querySnapshot.forEach(function(doc) {
                        db.collection("list").doc(doc.id).delete();
                        count++;
                    });

                    if (count == 0) {
                        const user = firebase.auth().currentUser;
                        user.delete();
                        that.sendGa('刪除帳號');
                        firebase.auth().signOut().then(function() {
                            that.$set('user', { uid: '', provider: '', displayName: '' });
                        }, function(error) {
                            // An error happened.
                        });
                    } else {
                        that.deleteMyAccount(true);
                    }
                }).catch(function(error) {
                    console.log("Error getting document:", error);
                });;

            }

        }
    }
});

var script = document.createElement('script');
script.onload = function() {
    // Your web app's Firebase configuration
    // For Firebase JS SDK v7.20.0 and later, measurementId is optional
    var firebaseConfig = {
        apiKey: "AIzaSyAtoSqn428jHyekJoMuhPXYJeWQtH8O6Mk",
        authDomain: "z358z358-roulette.firebaseapp.com",
        databaseURL: "https://z358z358-roulette.firebaseio.com",
        projectId: "z358z358-roulette",
        storageBucket: "z358z358-roulette.appspot.com",
        messagingSenderId: "1095342180247",
        appId: "1:1095342180247:web:575ab78fd455546c9b66d2",
        measurementId: "G-4HJT8VYHTF"
    };
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    firebase.analytics();
    //fire = firebase.database();
    db = firebase.firestore();
    vue.fireOn();
};
script.async = true;
script.src = "https://www.gstatic.com/firebasejs/8.6.5/firebase-firestore.js";
document.getElementsByTagName('head')[0].appendChild(script);

$(window).resize(vue.draw);

function labelFormatter(label, series) {
    return "<div style='text-anchor: start;font-family: Arial;font-size: 15px;text-align:center; padding:2px; color:white;'>" + label + "<br/>" + Math.round(series.percent) + "%</div>";
}

function afterChangeLang(lang) {
    $('[data-i18n]').localize();
    $('.i18n-title').each(function() {
        $(this).attr('title', i18next.t($(this).attr('title')));
    });
    $('.intro-step').each(function() {
        $(this).attr('data-intro', i18next.t($(this).data('intro-key')));
    });
    document.title = i18next.t('nav.home');

    $.timeago.settings.strings = webLangCustom[lang].translation.timeago;

    if (lang == 'en') {
        $('html').attr('lang', 'en');
    }
}

function copyStringToClipboard(str) {
    // Create new element
    var el = document.createElement('textarea');
    // Set value (string to be copied)
    el.value = str;
    // Set non-editable to avoid focus and move outside of view
    el.setAttribute('readonly', '');
    el.style = { position: 'absolute', left: '-9999px' };
    document.body.appendChild(el);
    // Select text inside element
    el.select();
    // Copy text to clipboard
    document.execCommand('copy');
    // Remove temporary element
    document.body.removeChild(el);
}