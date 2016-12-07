var noble = require('noble');


var isUp=false;
var isDown=false;
var startTime;
var endTime;

var exitHandlerBound=false;
var maxPeripherals=1;

var peripherals=[];
var http=require('http');
var server = http.createServer(function(request,response){

});

server.listen(1234,function(){
	console.log((new Date()) + " Server is listening on port 1234");
});

var WebSocketServer = require('websocket').server;
var utf8 = require('utf8');

var wsServer = new WebSocketServer({
	httpServer: server
});

var client;

wsServer.on('request',function(request){
	//runon connection and store it. WS client, not bean client
	client = request.accept(null,request.origin);
	console.log((new Date()) + " Connection accepted");

	//create event listener 
	client.on('message',function(message){
		var msgString = message.utf8Data;
		console.log("Message recieved: "+ msgString);
		if(peripherals.length==1){
			peripherals[0]['characteristics'][0].write(new Buffer(msgString,"binary"),true,function(error){
				console.log("sent message: "+ msgString);
			});
		}
	});

	//user disconnections
	client.on('close',function(reasonCode,description){
		delete client;
		console.log((new Date()) + " " + client.remoteAddress + " disconnected");
	});
});


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
	var desiredDevices = ["im bean da ba bean d"];
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
	peripherals[0]={};
	peripherals[0]['peripheral']=this.peripheral;
	//stop discovering
	if(peripherals.length<=maxPeripherals){
		noble.stopScanning();
		console.log('Max peripherals reached, stopping scanning');
	}
	if(!exitHandlerBound){
		exitHandlerBound=true;
		process.on('SIGINT',exitHandler);
	}
	this.peripheral.discoverServices([],setupService);
}

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
				peripherals[0]['characteristics'] = characteristics;
				requestNotify(characteristics[1]); // 2nd scratch characteristic
				//requestNotify(characteristics[0]); //this is first scratch characteristic (0-4)
			});
		}
	});
}; //setup service

var requestNotify = function(characteristic){
	//bind read handler for updates - so when data arrives we get a callback
	characteristic.on('read',function(data,isNotification){
		//you need to know what data is sent and in what format. Ours is 1 byte int
		//var tempC = data[0];
		//var tempF = tempC * 1.8+32;
		//console.log(" from " + this.uuid + ": " + tempC +"C ("+tempF + "F)");

		var dataString = data.toString('ascii').trim();
		console.log('dataString');
		if(client){
			client.sendUTF(utf8.encode(dataString));
		}




		//var dataString = data.toString('ascii').trim();
		//var values = dataString.split("|");
//
		//if(values.length <5){
		//	//there was some problem with data
		//	//ignore it
		//	console.log("Bad data: " +  dataString);
		//	return;
		//}
		//conver to g's
		//var x = values[1] * .00391;
		//var y = values[2] * .00391;
		//var z = values[3] * .00391;
//
		//var sum = Math.sqrt(Math.pow(x,2)+Math.pow(y,2)+Math.pow(z,2));
		//console.log("Sum: "+ sum);
//
		//if(sum > 2.1){
		//	//big force
		//	//aberration since 2G sensitivity is set
		//	//ignore
		//	return;
		//}
		////may need to tweak based on device etc
		//if(sum > 1.2 && !isUp){
		//	console.log("Heading up");
		//	isUp=true;
		//	startTime = Date.now();
		//}else if(sum <0.098 && isUp && !isDown){
		//	console.log("heading down");
		//	isDown= true;
		//}else if(sum > 0.97 && isDown){
		//	console.log("is landed");
		//	endTime = Date.now();
		//	var elapsedTime = (endTime-startTime)/2.0/1000.0;
		//	var height = Math.pow(elapsedTime,2) * 32.0/8.0;
		//	console.log("Height: "+ height+"ft over time: "+ elapsedTime);
		//	isDown=false;
		//	isUp=false;
		//}


	});
	//turn on notifications
	characteristic.notify(true,function(err){
		console.log("turned on notifications: " + (err ? "with error ": "without error"));
	});
};


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
//so the program will not close instantly
process.stdin.resume();