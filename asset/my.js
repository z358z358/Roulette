var fire = new Firebase('https://z358z358-roulette.firebaseio.com/');

var vue = new Vue({
  el: '#main',
  data: {
    options:[
    {name:'German', weight:1},
    {name:'French', weight:1},
    {name:'Italian', weight:1},
    {name:'Romansh', weight:1},
    ],
    goFlag: false,
    angle: 0,
    target: 0,
    turn: 0,
    logs:[],
    list:[],
    hot:0,
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
    //this.draw();
    if(window.location.hash){
      var hash = window.location.hash.substring(1); //Puts hash in variable, and removes the # character
      this.loadOption(hash);
    }
  },

  methods: {
    draw: function(offset){
      var tmp = [['名稱', '比重']];
      this.options.map(function(option){
        var weight = parseFloat(option.weight, 10);
        tmp.push([option.name,weight]);
      });

      var data = google.visualization.arrayToDataTable(tmp);

      var options = {
        pieSliceText: 'label',
        title: '123',
        pieHole: 0.3,
        //slices: offset,
      };
      var chart = new google.visualization.PieChart(document.getElementById('piechart'));
      chart.draw(data, options);
    },

    addOption: function(){
      this.options.unshift({name:'',weight:''});
    },

    removeOption: function (option) {
      this.options.$remove(option.$data);
    },

    go: function(){
      var options = this.options;
      var addAngle = Math.floor((Math.random() * 360));
      var sum = 0;
      var tmp = 0;
      if(this.goFlag == true){
        return;
      }

      options.map(function(option){
        sum += parseFloat(option.weight, 10);
      });

      //console.log(addAngle);
      for (var i = 0; i <= options.length - 1; i++) {
        tmp += (options[i].weight / sum) * 360;
        //console.log(tmp,i,options[i].weight / sum);
        if( tmp >= addAngle ){
          this.target = i;
          break;
        }
      };

      this.goFlag = true;
      this.angle = addAngle;
      $("#lotteryBtn").rotate({
        angle:this.angle, 
        duration: 1000,
        animateTo: addAngle + 1440,
        callback:this.goDone,
      }); 
    },

    goDone: function(){
      var a = {};
      var log = {};
      var times = (parseInt(this.options[this.target].times) || 0) + 1;      
      this.goFlag = false;
      this.turn = this.turn + 1;          
      this.draw(a);

      log.ts = new Date().toISOString();
      log.target = this.target;
      log.content = this.options[this.target].name;
      this.logs.unshift(log);

      this.options[log.target].$set('times',times);
      //this.go();

    },

    saveOnFireBase: function(){
      var ts = new Date().getTime();
      var tmp = fire.child('list').push({'options':this.options , ts:ts , hot:0 , title:this.title});
      window.location.hash = tmp.key();
    },

    getList: function(){
      var that = this;
      fire.child('list').orderByChild('hot').limitToLast(50).on("value", function(snapshot) {
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
    },

    setOptions: function(snapshot){
      if(snapshot.exists() === false) return;

      var tmp = snapshot.val();
      this.options = tmp.options; 
      this.hot = tmp.hot + 1; 
      this.draw();

      // 人氣+1
      snapshot.child("hot").transaction(function (current_value) {
        return (current_value || 0) + 1;
      });
    }
  }
});


google.load("visualization", "1", {packages:["corechart"]});
google.setOnLoadCallback(vue.draw);