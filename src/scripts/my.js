var fire;
$.cookie.json = true;

var vue = new Vue({
  el: '#main',
  data: {
    set:{
      options:[
      {name:'我隨便', weight:1},
      {name:'我都好', weight:1},
      {name:'都可以', weight:1},
      {name:'看你', weight:1},
      ],
      title:'今天想吃什麼?',
      ts:0,
      hot:0,
      uid:'',
    },

    c:{
      setTurn: 1,
      duration: 3000,
      volume: true,
      targetTag: 'piechart',
      chatType: 'plot',
    },

    s:{
      _url:'http://z358z358.github.io/Roulette/',
      url:'http://z358z358.github.io/Roulette/',
      text:$("meta[name='description']").attr('content'),
      title:$("title").text()
    },

    user:{
      provider:'',
      uid:'',
      displayName:'',
    },

    Msg:{type:'',msg:''},
    
    cookieKey: 'z358z358-roulette',
    hotKey: 'hot-cd',
    rid: '',    
    turnFlag: -1,
    goFlag: false,
    saveType:'',
    angle: 0,
    target: 0,
    turn: 0,
    sum: 0,
    logs:[],
    list:[],
  },

  watch: {
    // timeago
    'logs': function (val, oldVal) {
      jQuery(".timeago").timeago();
    },

    // timeago
    'list': function (val, oldVal) {
      jQuery(".timeago").timeago();
    }
  },

  filters: {
    persent: function (number) {
      return Math.round(number*100) + '%';
    }
  },

  ready: function(){    
    var c = $.cookie(this.cookieKey);
    if(c && Object.keys(this.c).length == Object.keys(c).length){
      this.c = c;
    }
    else{
      $('.first-intro').tooltip('show');
    }    
  },

  methods: {
    draw: function(){
      if(this.c.chatType == 'plot'){
        this.drawByPlot();
      }
      else{
        this.drawByGoole();
      }
      $("#piechart,#lotteryBtn").css('transform','rotate(0)');
      $.cookie(this.cookieKey, this.c, { path: '/' , expires: 365});
    },
    // google chart
    drawByGoole: function(){
      var tmp = [['名稱', '比重']];
      this.set.options.map(function(option){
        var weight = parseFloat(option.weight, 10);
        tmp.push([option.name,weight]);
      });

      var data = google.visualization.arrayToDataTable(tmp);

      var options = {
        pieSliceText: 'label',
        title: this.set.title,
        pieHole: 0.3,
        legend:{alignment:'center','position':'bottom'}
        //slices: offset,
      };
      var chart = new google.visualization.PieChart(document.getElementById('piechart'));
      chart.draw(data, options);      
    },

    drawByPlot: function(){
      var data = [];
      this.set.options.map(function(option){
        var weight = parseFloat(option.weight, 10);
        data.push({data:weight,label:option.name});
      });

      $.plot('#piechart', data, {
        series: {
        pie: {
            show: true,
            radius: 1,
            label: {
                show: true,
                radius: 2/3,
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

    addOption: function(){
      this.set.options.unshift({name:'',weight:''});
    },

    removeOption: function (option) {
      this.set.options.$remove(option.$data);
    },

    go: function(type){
      var options = this.set.options;
      var oldAngle = this.angle;
      var addAngle = Math.floor((Math.random() * 360));
      var sum = 0;
      var tmp = 0;

      if(this.goFlag == true){
        return;
      }

      if(type == 'c'){
        this.turnFlag = this.c.setTurn;        
      }

      options.map(function(option){
        sum += parseFloat(option.weight, 10);
      });
      this.sum = sum;

      //console.log(addAngle);
      for (var i = 0; i <= options.length - 1; i++) {
        tmp += (options[i].weight / sum) * 360;
        //console.log(tmp,i,options[i].weight / sum);
        if( tmp >= addAngle ){
          this.target = i;
          break;
        }
      };

      if(this.c.chatType == 'google'){
        this.c.targetTag = 'lotteryBtn';
      }

      if(this.c.targetTag == 'piechart'){
        addAngle = 360 - addAngle;
      }

      this.goFlag = true;
      this.angle = addAngle;
      if(this.c.volume) document.getElementById("sound").play();
      $("#" + this.c.targetTag).rotate({
        angle:oldAngle, 
        duration: this.c.duration,
        animateTo: addAngle + 1800,
        callback:this.goDone,
      }); 
    },

    goDone: function(){
      var a = {};
      var log = {};
      var times = (parseInt(this.set.options[this.target].times) || 0) + 1;      
      this.goFlag = false;
      this.turn = this.turn + 1;

      log.ts = new Date().getTime();
      log.target = this.target;
      log.content = this.set.options[this.target].name;
      this.logs.unshift(log);
      if(this.logs.length > 500){
        this.logs.pop();
      }

      this.set.options[log.target].$set('times',times);
      if(this.turnFlag >= 1) {
        this.turnFlag--;
        if(this.turnFlag >= 1){
          this.go();
        }        
      }
      else{
        if(this.c.volume) document.getElementById("end").play();
      }
    },

    saveOnFireBase: function(){
      var that = this;
      var tmp = $.extend( {}, this.set );
      var tmp2;

      tmp.ts = new Date().getTime();
      for (var i = tmp.options.length - 1; i >= 0; i--) {
        delete tmp.options[i].times;
      };
      delete tmp.hot;

      if(tmp.uid && tmp.uid === this.user.uid && this.rid){
        fire.child('list/' + this.rid).update(tmp, function(error){
          if (error) {
            that.$set('Msg' , {type:'error',msg:'儲存轉盤 失敗!'});
          }
          else{
            that.$set('Msg' , {type:'success',msg:'儲存轉盤 成功!'});
          }
        });
      }
      else {
        //console.log('新增');
        tmp.hot = 0;
        this.set.uid = tmp.uid = this.user.uid;
        tmp2 = fire.child('list').push(tmp);
        if(!tmp2){
          that.$set('Msg' , {type:'error',msg:'新增轉盤 失敗!'});
          return;
        }
        else{
          that.$set('Msg' , {type:'success',msg:'新增轉盤 成功!'});
        }
        this.rid = window.location.hash = tmp2.key();        
      }

      this.draw();
    },

    getList: function(type){
      var that = this;
      var title = (type == 'hot') ? '熱門轉盤' : '最新上架' ;
      var tmp = fire.child('list');      
      var type2 = (type == 'my') ? 'ts' : type ;

      title = (type == 'my') ? '我的轉盤' : title ;
      this.$set('listType' , type2);
      this.$set('listTitle' , title);

      if(type == 'my' && this.user.uid){
        tmp = tmp.orderByChild('uid').equalTo(this.user.uid);
      }
      else{
        tmp = tmp.orderByChild(type2);
      }

      tmp.limitToLast(50).once("value", function(snapshot) {
        //console.log(snapshot);
        var tmp = [];
        snapshot.forEach(function(data) {
          var a = data.val();
          a.id = data.key();
          tmp.push(a);
        });

        that.list = tmp;        
      });
    },

    loadOption: function(id){
      var tmp = fire.child('list/' + id);
      tmp.once("value", this.setOptions); 
      $("#list-modal").modal('hide');
      $(".navbar-toggle:not(.collapsed)").click();  
    },

    setOptions: function(snapshot){
      var oldRid = this.rid;
      if(snapshot.exists() === false) {
        this.rid = '';
        this.draw();
        return;
      }

      var tmp = snapshot.val();
      var title = tmp.title + ' - 自訂轉盤';
      this.set = tmp;
      $("title").text(title);
      this.s.title = title;

      this.draw();
      
      this.rid = snapshot.key();
      this.s.url = this.s._url + '#' + this.rid;
      if(this.rid != oldRid){
        FB.XFBML.parse(); 
      }
      
      if( !$.cookie(this.hotKey) ){
        $.cookie(this.hotKey, '1', { path: '/' , expires: 1});
        this.incHot(snapshot.key());
      }
    },

    // 人氣+1
    incHot: function(id){
      fire.child('list/' + id + '/hot').transaction(function (current_value) {
        return (current_value || 0) + 1;
      });
    },

    login: function(type){
      var that = this;
      if(type == 'logout'){
        fire.unauth();
        this.$set('user', {uid:'',provider:'',displayName:''});
      }
      else{
        fire.authWithOAuthPopup(type, function(error, authData) {
          if (error) {
            //console.log("Login Failed!", error);
          } else {
            that.loginBack(authData);          
          }
        });
      }
    },

    loginBack: function(authData){
      //console.log("Authenticated successfully with payload:", authData , that);
      this.user.uid = authData.uid;
      this.user.provider = authData.provider;    
      this.user.displayName = authData[this.user.provider].displayName;
      $(".navbar-toggle:not(.collapsed)").click();
    },

    deleteLog: function(type){
      if(type == 'all'){
        this.$set('logs', []);
        this.set.options.map(function(option){
          option.$set('times', 0);
        });
        this.turn = 0;
      }
    },

    setVolume: function(value){
      this.c.$set('volume' , value);
      $.cookie(this.cookieKey, this.c, { path: '/' , expires: 365});
    },

    showIntro: function(){
      introJs().setOptions({prevLabel: '&larr; 上一步', nextLabel:'下一步 &rarr;', skipLabel: '跳過' ,doneLabel:'結束'}).start();
    },

    // firebase斷線  官方說1連接大概是1000瀏覽次數/月，所以50連接限制大概要每個月50K瀏覽才會到
    // 應該不會破表 暫時不用
    goOffline: function(){
      Firebase.goOffline();
    },

    goOnline: function(){
      Firebase.goOnline();
    },

    showDsq: function(){
      if(this.dsq){
        return;
      }
      /* * * DON'T EDIT BELOW THIS LINE * * */
      (function() {
        var dsq = document.createElement('script'); dsq.type = 'text/javascript'; dsq.async = true;
        dsq.src = '//' + disqus_shortname + '.disqus.com/embed.js';
        (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(dsq);
      })();

      this.$set('dsq',true);
    },

    fireOn: function(){
      if(window.location.hash){
        this.rid = window.location.hash.substring(1); //Puts hash in variable, and removes the # character
        this.loadOption(this.rid);
      }
      else{
        this.draw();
      }

      var authData = fire.getAuth();
      if(authData){
        this.loginBack(authData);
      }
    }
    
  }
});

var script = document.createElement('script');
script.onload = function() {
  fire = new Firebase('https://z358z358-roulette.firebaseio.com/');
  vue.fireOn();
};
script.async=true;
script.src = "https://cdn.firebase.com/js/client/2.2.1/firebase.js";
document.getElementsByTagName('head')[0].appendChild(script);

$( window ).resize(vue.draw);

function labelFormatter(label, series) {
  return "<div style='text-anchor: start;font-family: Arial;font-size: 15px;text-align:center; padding:2px; color:white;'>" + label + "<br/>" + Math.round(series.percent) + "%</div>";
}