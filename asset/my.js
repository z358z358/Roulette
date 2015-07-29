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
  },

  watch: {
    // timeago
    'logs': function (val, oldVal) {
      jQuery("abbr.timeago").timeago();
    }
  },

  filters: {
    persent: function (number) {
      return Math.round(number*100) + '%';
    }
  },

  ready: function(){
    //this.draw();
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
      this.go();

    }
  }
});


$(function(){
  var timeOut = function(){  //超时函数
    $("#lotteryBtn").rotate({
      angle:0, 
      duration: 10000, 
      animateTo: 2160, //这里是设置请求超时后返回的角度，所以应该还是回到最原始的位置，2160是因为我要让它转6圈，就是360*6得来的
      callback:function(){
        alert('网络超时')
      }
    }); 
  }; 
  var rotateFunc = function(awards,angle,text){  //awards:奖项，angle:奖项对应的角度
    $('#lotteryBtn').stopRotate();
    $("#lotteryBtn").rotate({
      angle:0, 
      duration: 5000, 
      animateTo: angle+1440, //angle是图片上各奖项对应的角度，1440是我要让指针旋转4圈。所以最后的结束的角度就是这样子^^
      callback:function(){
        alert(text)
      }
    }); 
  };
  
  $("#lotteryBtn2").rotate({ 
   bind: 
   { 
    click: function(){
      var time = [0,1];
      time = time[Math.floor(Math.random()*time.length)];
      if(time==0){
          timeOut(); //网络超时
        }
        if(time==1){
          var data = [1,2,3,0]; //返回的数组
          data = data[Math.floor(Math.random()*data.length)];
          if(data==1){
            rotateFunc(1,157,'恭喜您抽中的一等奖')
          }
          if(data==2){
            rotateFunc(2,247,'恭喜您抽中的二等奖')
          }
          if(data==3){
            rotateFunc(3,22,'恭喜您抽中的三等奖')
          }
          if(data==0){
            var angle = [67,112,202,292,337];
            angle = angle[Math.floor(Math.random()*angle.length)]
            rotateFunc(0,angle,'很遗憾，这次您未抽中奖')
          }
        }
      }
    }          
  });
  
})

google.load("visualization", "1", {packages:["corechart"]});
google.setOnLoadCallback(vue.draw);