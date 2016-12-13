
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var index = require('./routes/index');

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var Fiber = require('fibers');
var Future = require('fibers/future');

var noble = require('noble');
var utf8 = require('utf8');

var maxPeripherals=2;
var peripherals=[];
var exitHandlerBound=false;
var characteristicCount=0;

//The notes and their frequencies defined out. Blank is a rest

var tones = {
  'c0':163,'d0':183, 'ef0':194,'e0':206, 'f0':218, 'f0#':231,'g0':245, 'a0':275, 'bf0':291,'b0':308,
  'c1':327,'d1':367, 'ef1':388,'e1':412, 'f1':436, 'f1#':462, 'g1':490, 'a1':550, 'bf1':582,'b1':617,
  'c2':654,'d2':734, 'ef2':777,'e2':824, 'f2':873, 'f2#':925,'g2':980, 'a2':1100, 'bf2':1165,'b2':1235,
  'c3':1308,'d3':1468,'ef3':1556, 'e3':1648, 'f3':1746,'f3#':1850, 'g3':1960, 'a3':2200, 'bf3':2331,'b3':2469,
  ' ':"STOP"
};

//This object contains all songs that the beans can play. It includes the option for separate notes for more than one
//  bean for the same song, allowing for greater song complexity. It also includes the note durations.

var songs= {
  'rowrowyourboat': {
    'notes': [['c2', 'c2', 'c2', 'd2', 'e2', 'e2', 'd2', 'e2', 'f2', 'g2', ' ', 'c3', 'c3', 'c3',
      'g2', 'g2', 'g2', 'e2', 'e2', 'e2', 'c2', 'c2', 'c2', 'g2', 'f2', 'e2', 'd2', 'c2'],
      ['c2', 'c2', 'c2', 'd2', 'e2', 'e2', 'd2', 'e2', 'f2', 'g2', ' ', 'c3', 'c3', 'c3',
        'g2', 'g2', 'g2', 'e2', 'e2', 'e2', 'c2', 'c2', 'c2', 'g2', 'f2', 'e2', 'd2', 'c2']
    ],
    'duration': [[2.5, 2.5, 1.5, 1, 2.5, 1.5, 1, 1.5, 1, 4.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 1, 1.5, 1, 4.5, 1],
      [2.5, 2.5, 1.5, 1, 2.5, 1.5, 1, 1.5, 1, 4.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 1, 1.5, 1, 4.5, 1

      ]]
  },
  'starwars': {
    'notes': [['g1','g1','g1','g1','g1','g1','g1','g1','f1#','f1#','f1#',
      'g1','g1','g1','g1','g1','g1','g1','g1','f1#','f1#','f1#',
      'g1','g1','g1','g1','g1','g1','g1','g1','f1#','f1#','f1#',
      'g1','g1','g1','g1','g1','g1','g1','g1','f1#','f1#','f1#',
       'g2','g2','g2','e2','bf2',
        'g2','ef2','bf2','g2',' ',
        'b2','b2','b2','c3','b2',
        'f2#','ef2','bf2','g2'],
       ['g0','g0','g0','ef0',
        'g0','g0','g0','ef0',
        'g0','g0','g0','ef0',
        'g0','g0','g0','ef0',
        'd0','d0','d0','ef0',
        'g0','f0#','g0','g0','g0','g0','g0','g0',
        'g0','g0','g0','f0#',
        'ef0','c0','g0']],
    'duration': [[1,.5,.25,.25,.25,.5,.25,.25,.25,.25,.5,
                  1,.5,.25,.25,.25,.5,.25,.25,.25,.25,.5,
                  1,.5,.25,.25,.25,.5,.25,.25,.25,.25,.5,
                  1,.5,.25,.25,.25,.5,.25,.25,.25,.25,.5,
                  1,1,1,.75,.25,
                  1,.75,.25,2,2,
                  1,1,1,.75,.25,
                  1,.75,.25,2],
      [1.45,1.45,1.45,1.45,
        1.45,1.45,1.45,1.45,
        1.45,1.45,1.45,1.45,
        1.45,1.45,1.45,1.45,
        1,1,1,1,
        1,1,2,.25,.25,.25,.25,.5,
        1,1,1,1,
        1,1,2]]
  }
};
//[1,.5,.25,.25,.25,.5,.25,.25,.25,.25,.5]
//replicating a sleep function that is blocking in its own context but not blocking for the node event loop as a whole
function sleep(ms) {
  var fiber = Fiber.current;
  setTimeout(function() {
    fiber.run();
  }, ms);
  Fiber.yield();
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
//app.use(express.static(path.join(__dirname, 'public')));

//app.use('/', index);
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

/*
 *  This method is what handles playing a specific song. It is passed a song name and will then play that song on the
 *  number of connected beans. It can handle different note series for different beans and durations for those notes.
 *  It streams the notes to the bean in order. No notes are stored on the end of the bean.
 */
function playSong(songName){
  if(peripherals.length>=1){


    for (var y = 0; y < characteristicCount; y++) {

      var variables=[];
      variables[0]=songName;
      variables[1]=y;

    //This handles the looping in order making sure the sleep doesn't stop the entire event loop while being synchronous
    Fiber(function(variables) {
      console.dir(variables);

      var name = variables[0];
      var beanid = variables[1];
      for(var x=0; x<songs[name]['notes'][beanid].length;x++) {
          //Send the note to the bean to play. Sends only frequency. No duration or note name
          peripherals[beanid]['characteristics'][0].write(new Buffer("" + tones[songs[name]['notes'][beanid][x]], "binary"), true, function (error) {
            console.log("sent : " + tones[songs[name]['notes'][beanid][x]]);
          });
          //wait based on the note duration
          sleep(songs[name]['duration'][beanid][x] * 500);
          //Tell the bean to stop playing the note for a brief break between notes
          peripherals[beanid]['characteristics'][0].write(new Buffer("STOP", "binary"), true, function (error) {
            console.log("sent : STOP");
          });
          sleep(100);
        }
    }).run(variables);
  }

  }else{
    console.log('no beans to play to');
  }
}


//socket stuffs
io.on('connection', function (socket) {
  console.log("Web socket: user connected");
  //if we get an event to pay a specific note from user
  socket.on('playnote', function (data) {
    console.log("Playnote recieved: "+ data);
    if(peripherals.length>=1) {
      //just looks up the note tone
      var msgString = "" + tones[data];
      for (var y = 0; y < peripherals.length; y++) {
        peripherals[y]['characteristics'][0].write(new Buffer(msgString, "binary"), true, function (error) {
          console.log("sent message to bean: " + msgString);
        });
      }
    }
  });
  //this handles stopping playing a note
  socket.on('STOP', function (data) {
    console.log("STOP recieved: ");
    if(peripherals.length>=1){
      for (var y = 0; y < peripherals.length; y++) {
        peripherals[y]['characteristics'][0].write(new Buffer("STOP", "binary"), true, function (error) {
          console.log("sent STOP message to bean: ");
        });
      }
    }

    socket.on('playsong', function (song) {
      console.log('starting to play song: '+song);
      playSong(song);
    });

  });

  //user disconnects
  socket.on('disconnect', function (data) {
    console.log('user disconnected');
  });
});

//bluetooth bean interaction

var uuid = 'a495ff10c5b14b44b5121370f02d74de';

noble.on('stateChange',function (state){
  //possiblestates: unknown,resetting,unsupported, unauthorized,
  //poweredOff, poweredOn
  if(state==="poweredOn"){
    console.log("poweredOn");
    //for next line, false = do not allow multiple devices differentiated by UUID
    //limit to devices having the service UUID below which all beans have
    noble.startScanning([uuid],false);

  }
});

noble.on('discover',function(peripheral){
  //check the name to see if it is one we want
  var desiredDevices = ["im bean da ba bean d","PiratesCaribBean+"];
  if(peripheral.advertisement.localName && desiredDevices.indexOf(peripheral.advertisement.localName) >-1){
    console.log("found device with localName: "+ peripheral.advertisement.localName);
    console.log("Device UUID: "+ peripheral.uuid);
    console.log("advertising services: "+ peripheral.advertisement.serviceUuids);
    console.log();
    peripheral.connect(connect.bind({peripheral:peripheral}));

  }
});

var connect = function(err){
  if(err) throw err;

  console.log("connnection to "+ this.peripheral.uuid);
  peripherals[characteristicCount]={};
  peripherals[characteristicCount]['peripheral']=this.peripheral;
  //stop discovering
  if(peripherals.length===maxPeripherals){
    noble.stopScanning();
    console.log('Max peripherals reached, stopping scanning');
  }
  if(!exitHandlerBound){
    exitHandlerBound=true;
    process.on('SIGINT',exitHandler);
  }
  this.peripheral.discoverServices([],setupService);
};

//setup notifications which begins with discovering the services for the device, find the right one
// then find the characteristic we want.

var setupService = function(err,services){
  if(err){
    throw err;
  }

  services.forEach(function(service){
    if(service.uuid ==='a495ff20c5b14b44b5121370f02d74de'){
      console.log("found bean scratch UUID");
      var characteristicUUIDS = ['a495ff21c5b14b44b5121370f02d74de',
        'a495ff22c5b14b44b5121370f02d74de',
        'a495ff23c5b14b44b5121370f02d74de',
        'a495ff24c5b14b44b5121370f02d74de',
        'a495ff25c5b14b44b5121370f02d74de'];

      service.discoverCharacteristics(characteristicUUIDS,function(err,characteristics){
        console.log("got characteristics");
        peripherals[characteristicCount]['characteristics'] = characteristics;
        //requestNotify(characteristics[1]); // 2nd scratch characteristic
        //requestNotify(characteristics[0]); //this is first scratch characteristic (0-4)
        characteristicCount++;
      });
    }
  });
}; //setup service

var exitHandler = function exitHandler(){
  peripherals.forEach(function(peripheral){
    console.log('disconnecting from '+ peripheral['peripheral'].uuid+"....");
    peripheral['peripheral'].disconnect(function(){
      console.log("disconnected");
    });
  });
  //end process after two more seconds
  setTimeout(function(){
    process.exit();
  },2000);
};














/********************* Don't really need to touch the stuff below this ***************************/

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

http.listen(8080, function () {
  console.log('Example app listening on port 8080!')
});

module.exports = app;
