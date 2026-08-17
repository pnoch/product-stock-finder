const webPush = require("web-push");

const keys = webPush.generateVAPIDKeys();
console.log("VAPID_SUBJECT=mailto:you@example.com");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("Add these to your server env, and EXPO_PUBLIC_VAPID_PUBLIC_KEY to your client env.");
