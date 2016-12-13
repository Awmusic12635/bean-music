//SPEAKER PIN IN 3
int speakerPin = 3;


String getCommand(){
  ScratchData scratchCommand = Bean.readScratchData(1);
  String strCmd;
  for(int i=0;i<scratchCommand.length;i++){
    strCmd +=(String)(char) scratchCommand.data[i];
  } 
  return strCmd;
}

void setup() {
  // put your setup code here, to run once:
  Bean.enableWakeOnConnect(true);

  //start led
  Bean.setLed(0,0,0);

  pinMode(speakerPin,OUTPUT);

  uint8_t buffer[1] = {' '};

  Bean.setScratchData(1,buffer,1);

  //flash LED to indicate setup is done
  delay(10);
  Bean.setLed(255,255,255);
  delay(250);
  Bean.setLed(0,0,0);
  delay(10);
}

void loop() {
  // put your main code here, to run repeatedly:
  boolean connected = Bean.getConnectionState();
  if(connected){
    String strCmd = getCommand();

    if(strCmd == "STOP"){
       //clear
       noTone(speakerPin);
       uint8_t buffer[1]={' '};
       Bean.setScratchData(1,buffer,1);
    }
    
    //if command is empty or single space
    else if(strCmd.length()>0 && strCmd!= " "){
      int toneFreq = strCmd.toInt();
      //use tone because it works in the background
      tone(speakerPin,toneFreq);

    }
  }
  //Bean.sleep(100);
}



