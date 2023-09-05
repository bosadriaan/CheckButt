

const video = document.getElementById("video");
let isDetectionRunning = false;
let isMuted = false;
let detectionInterval;
const toggleButton = document.getElementById("toggleButton");
const MODEL_URI = "/models";
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const supportsVibration = "vibrate" in navigator;
let tightnessFactor = 0.5; // Set the tolerance for face deviation from the exact mid. Nosetip between the eyes.






// SET THE CONTROL LISTENERS AND FUNCTIONS

const muteButtonContainer = document.querySelector(".mute-btn");
muteButtonContainer.addEventListener("click", function () {
  isMuted = !isMuted; // Toggle the mute state
  playTick(1);
  // Toggle the 'active' class on the entire container
  muteButtonContainer.classList.toggle("active");
});

const powerButtonContainer = document.querySelector(".power-btn");
powerButtonContainer.classList.add("inactive");
powerButtonContainer.addEventListener("click", function () {
  // Toggle the 'active' class on the entire container
  powerButtonContainer.classList.toggle("active");
  playTick(1);
  isDetectionRunning = !isDetectionRunning;
  if (isDetectionRunning) {
    // If the detection is now running, start it.
    startDetection();
    if (supportsVibration) {
      navigator.vibrate(50); // Vibrate for 200 milliseconds
    }
  } else {
    // If the detection has been stopped, reflect that.
    console.log("Time to go home..");
  }
});


// LOAD THE DETECTION MODELS FOR FACE AND LANDMARKS

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
  faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URI),
])
  .then(playVideo)
  .catch((err) => {
    console.log(err);
  });


//START HIDDEN VIDEO AND DO WARM-UP DETECTION

function playVideo() {
  if (!navigator.mediaDevices) {
    console.error("mediaDevices not supported");
    return;
  }
  navigator.mediaDevices
    .getUserMedia({
      video: {
        aspectRatio: 4 / 3,
        width: 800, // { min: 640, ideal: 1280, max: 1920 },
        height: 600, //{ min: 360, ideal: 720, max: 1080 },
        facingMode: "environment",
        advanced: [{ zoom: 2 }],
      },
      audio: false,
    })
    .then(function (stream) {
      video.srcObject = stream;

      // Warm-up the detector after a slight delay to ensure we have video frames
      setTimeout(async () => {
        await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true); // true means use TinyModel
        console.log("Warm-up detection completed.");
        processFrame();
        console.log("Warm-up full run completed.");
        powerButtonContainer.classList.remove("inactive");  // Enable the "Start" button
      }, 200);
    })
    .catch(function (err) {
      console.log(err.name, err.message);
    });
}


//PROCESS A VIDEO FRAME AND DETECT THE NUMBER OF FACES LOOKING AT THE CAMERA

function processFrame() {
  const startTime = Date.now();
  // Start asynchronous face detection for the current frame
  faceapi
    .detectAllFaces(
      video,
      new faceapi.TinyFaceDetectorOptions({
        scoreThreshold: 0.2, // what counts as a face
        inputSize: 800, //resolution of the frame to process, must be divisible by 32 (320, 640, 800)
      })
    )
    .withFaceLandmarks(true)
    .then((detections) => {
      let counter = 0;
      for (let detection of detections) {
        const landmarks = detection.landmarks;
        const noseTip = landmarks.getNose()[2];
        const leftEye = landmarks.getLeftEye()[0];
        const rightEye = landmarks.getRightEye()[3];
        const middlePoint = leftEye.x + (rightEye.x - leftEye.x) / 2;
        const allowedDeviation =
          ((rightEye.x - leftEye.x) / 2) * tightnessFactor;
        if (
          noseTip.x > middlePoint - allowedDeviation &&
          noseTip.x < middlePoint + allowedDeviation
        ) {
          counter++;
        }
      }

      if (counter > 0) {

        flashLight(1);
        playTick(counter);
      }

      // Schedule next frame processing
      if (isDetectionRunning) {
        const elapsedTime = Date.now() - startTime;
        const delay = Math.max(250 - elapsedTime, 0); // max 1000/XX fps
        setTimeout(processFrame, delay); // testing delay
      }
    })
    .catch((err) => {
      console.error("Error processing frame:", err);
    });
}


//START OFF THE DETECTION LOOP

// Modify the startDetection function to initiate the recursive mechanism
function startDetection() {
  isDetectionRunning = true;
  processFrame();
}


// PLAY A SOUND, VIBRATION AND FLASH FOR EACH FACE DETECTION

function playTick(beepCount) {

  for (let i = 0; i < beepCount; i++) {
    setTimeout(() => {
      if (supportsVibration) {
        navigator.vibrate([25]);
      }

      if (isMuted) {
        return; // Exit the function if muted.
      }
      const oscillator = audioContext.createOscillator();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.05);
    }, i * 80);
  }
}

function flashLight(count) {
  for (let i = 0; i < count; i++) {
    const redCircle = document.getElementById("redCircle");
    redCircle.classList.add("active-flash");
    setTimeout(() => redCircle.classList.remove("active-flash"), 50);
  }
}
