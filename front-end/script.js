// Replace with your Vultr VM's IP address
const socket = new WebSocket('ws://YOUR_VULTR_IP:8000/ws/communication-bridge');

// 1. Sending Video Frames to Gemini
function sendFrame(base64Image) {
    socket.send(JSON.stringify({
        "type": "video_frame",
        "frame": base64Image
    }));
}

// 2. Receiving Data from the Agent
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.event === "animate_avatar") {
        console.log("Avatar should perform:", data.data);
        // This is where you'd trigger your Figma/3D model animation
        triggerAvatarAnimation(data.data);
    } 
    
    if (data.text) {
        console.log("Translation for Blind User:", data.text);
        // Display this on the screen for the Deaf user
        updateChatUI(data.text, data.emotion);
    }
};