var ws = new WebSocket('ws://localhost:1234');
ws.onopen = function(){
	console.log("Connected");
}
ws.onerror = function(){
	console.log('error: '+error);
}
ws.addEventListener("message",function(e){
	var msg = e.data;
	console.log(msg);
	document.getElementById('currentTemp').innerHTML = "<p>As of " + new Date() + ", current " + msg+ " degrees C</p>";
});

function outputUpdate(which,val){
	console.log("test");
	console.log(which);
	console.log(val);
	var selector ="Value";
	switch(which){
		case "red":
			selector="#red"+selector;
			break;
		case "blue":
			selector="#blue"+selector;
			break;
		case "green":
			selector="#green"+selector;
			break;
	}
	document.querySelector(selector).value=val;
	var message =which.substr(0,1)+":"+val;
	ws.send(message);
}

function turnOff(){
	ws.send("OFF:");
}

function getTemp(){
	ws.send("TEMP:");
}