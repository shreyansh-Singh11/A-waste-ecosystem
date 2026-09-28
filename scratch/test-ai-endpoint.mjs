const png1x1 = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

async function test(name) {
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`),
    png1x1,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  const res = await fetch('http://localhost:3000/api/v1/identify-ewaste', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: body
  });
  const data = await res.json();
  console.log(`${name.padEnd(25)} -> ${data.device.padEnd(30)} | Grade: ${data.condition?.grade} | Outcome: ${data.recommendedOutcome.padEnd(14)} | Hazard: ${data.isHazardousBattery}`);
}

await test('iphone_12_pro.png');
await test('swollen_battery.png');
await test('ultrasharp_monitor.png');
await test('motherboard_pcb.png');
await test('unknown_photo.png');
