const video = document.getElementById("video");
const reminder = document.getElementById("reminder");
const status = document.getElementById("status");
const stats = document.getElementById("stats");
const stillTimeElement = document.getElementById("stillTime");
const movementStatusElement = document.getElementById("movementStatus");
const dismissBtn = document.getElementById("dismissBtn");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

let lastPosition = null;
let stillCount = 0;
const CHECK_INTERVAL = 1000; // ms
const STILL_THRESHOLD = 15; // 15초 동안 같은 위치면 알림

// 상태 업데이트 함수
function updateStatus(message) {
  status.textContent = message;
}

// 통계 업데이트 함수
function updateStats() {
  stillTimeElement.textContent = stillCount;
  movementStatusElement.textContent =
    stillCount > 0 ? "정적 상태" : "움직임 감지됨";
  movementStatusElement.style.color =
    stillCount > STILL_THRESHOLD / 2 ? "#f56565" : "#3182f6";
}

// 얼굴 감지 시각화
function drawFaceDetection(detection) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  if (detection) {
    const { x, y, width, height } = detection.box;

    // 얼굴 테두리 그리기
    ctx.strokeStyle = "#3182f6";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // 중심점 표시
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    ctx.fillStyle = "#3182f6";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
    ctx.fill();

    // 상태에 따른 색상 변경
    if (stillCount > STILL_THRESHOLD / 2) {
      ctx.strokeStyle = stillCount > STILL_THRESHOLD ? "#f56565" : "#f6ad55";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
    }
  }
}

async function setupCamera() {
  try {
    updateStatus("카메라 접근 중...");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 640,
        height: 480,
        facingMode: "user",
      },
    });
    video.srcObject = stream;
    updateStatus("카메라 준비 완료");
  } catch (error) {
    console.error("카메라 접근 실패:", error);
    updateStatus("카메라 접근 실패");
    alert("카메라 접근이 필요합니다. 브라우저에서 카메라 권한을 허용해주세요.");
  }
}

async function loadModels() {
  try {
    updateStatus("AI 모델 로딩 중...");
    console.log("모델 로딩 시작...");
    await faceapi.nets.tinyFaceDetector.loadFromUri(
      "./public/models/tiny_face_detector"
    );
    console.log("모델 로딩 완료");
    updateStatus("AI 모델 준비 완료");
  } catch (error) {
    console.error("모델 로딩 실패:", error);
    updateStatus("CDN에서 모델 로딩 중...");
    // CDN에서 모델 로딩 시도
    try {
      console.log("🔄 CDN에서 모델 로딩 시도...");
      await faceapi.nets.tinyFaceDetector.loadFromUri(
        "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
      );
      console.log("CDN 모델 로딩 완료");
      updateStatus("AI 모델 준비 완료");
    } catch (cdnError) {
      console.error("CDN 모델 로딩도 실패:", cdnError);
      updateStatus("모델 로딩 실패");
      alert(
        "모델 로딩에 실패했습니다. 인터넷 연결을 확인하거나 웹 서버를 실행해주세요."
      );
    }
  }
}

function getMidPoint(box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

async function detectLoop() {
  const result = await faceapi.detectSingleFace(
    video,
    new faceapi.TinyFaceDetectorOptions()
  );

  if (result) {
    // 얼굴 감지 시각화
    drawFaceDetection(result);

    const current = getMidPoint(result.box);
    if (lastPosition && distance(lastPosition, current) < 10) {
      stillCount++;
    } else {
      stillCount = 0;
    }

    lastPosition = current;

    // 통계 업데이트
    updateStats();

    if (stillCount > STILL_THRESHOLD) {
      reminder.classList.remove("hidden");
      updateStatus("휴식이 필요해요");
    } else {
      reminder.classList.add("hidden");
      if (stillCount === 0) {
        updateStatus("얼굴 감지 중");
      } else {
        updateStatus(`${stillCount}초 동안 정적 상태`);
      }
    }
  } else {
    // 얼굴이 감지되지 않음
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    updateStatus("얼굴을 찾을 수 없어요");
    stillCount = 0;
    lastPosition = null;
    updateStats();
    reminder.classList.add("hidden");
  }

  setTimeout(detectLoop, CHECK_INTERVAL);
}

// 알림 해제 기능
dismissBtn.addEventListener("click", () => {
  reminder.classList.add("hidden");
  stillCount = 0;
  lastPosition = null;
  updateStatus("다시 감지를 시작해요");
  updateStats();
});

(async () => {
  try {
    await loadModels();
    await setupCamera();

    // 비디오가 로딩될 때까지 대기
    video.addEventListener("loadeddata", () => {
      console.log("비디오 로딩 완료, 얼굴 감지 시작");
      updateStatus("준비 완료! 감지를 시작해요");
      stats.classList.remove("hidden");
      detectLoop();
    });
  } catch (error) {
    console.error("초기화 실패:", error);
    updateStatus("초기화 실패");
  }
})();
