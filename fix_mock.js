const fs = require('fs');
let code = fs.readFileSync('lib/mockData.ts', 'utf8');

code = code.replace(/children: \["c-sato", "c-suzuki", "c-takahashi"\]\.map\(id => toMagnet\(id\)\)/g, 'trips: [{ id: "shift-1-trip-1", tripIndex: 1, children: ["c-sato", "c-suzuki", "c-takahashi"].map(id => toMagnet(id)) }]');
code = code.replace(/children: \["c-ito", "c-watanabe"\]\.map\(id => toMagnet\(id\)\)/g, 'trips: [{ id: "shift-3-trip-1", tripIndex: 1, children: ["c-ito", "c-watanabe"].map(id => toMagnet(id)) }]');
code = code.replace(/children: \["c-yamamoto"\]\.map\(id => toMagnet\(id\)\)/g, 'trips: [{ id: "shift-4-trip-1", tripIndex: 1, children: ["c-yamamoto"].map(id => toMagnet(id)) }]');
code = code.replace(/children: \["c-kobayashi"\]\.map\(id => toMagnet\(id\)\)/g, 'trips: [{ id: "shift-5-trip-1", tripIndex: 1, children: ["c-kobayashi"].map(id => toMagnet(id)) }]');
code = code.replace(/children: \["c-kato", "c-yoshida"\]\.map\(id => toMagnet\(id\)\)/g, 'trips: [{ id: "shift-6-trip-1", tripIndex: 1, children: ["c-kato", "c-yoshida"].map(id => toMagnet(id)) }]');
code = code.replace(/children: \["c-yamada"\]\.map\(id => toMagnet\(id\)\)/g, 'trips: [{ id: "shift-7-trip-1", tripIndex: 1, children: ["c-yamada"].map(id => toMagnet(id)) }]');

// Replace empty children arrays specifically in the shifts 2, 8, 9, 10
code = code.replace(/driverName: "増孁E, capacity: 8,\n      children: \[\]/g, 'driverName: "増田", capacity: 8,\n      trips: [{ id: "shift-2-trip-1", tripIndex: 1, children: [] }]');
code = code.replace(/driverName: "矢冁E, capacity: 5,\n      children: \[\]/g, 'driverName: "矢沢", capacity: 5,\n      trips: [{ id: "shift-8-trip-1", tripIndex: 1, children: [] }]');
code = code.replace(/driverName: "琁E長", capacity: 7,\n      children: \[\]/g, 'driverName: "班長", capacity: 7,\n      trips: [{ id: "shift-9-trip-1", tripIndex: 1, children: [] }]');
code = code.replace(/driverName: "高宮", capacity: 4,\n      children: \[\]/g, 'driverName: "高宮", capacity: 4,\n      trips: [{ id: "shift-10-trip-1", tripIndex: 1, children: [] }]');


// Also there is some mojibake in driverName in the mockData file since powershell gave me weird characters. Let's just fix it without regex by doing string indexOf.

let newCode = fs.readFileSync('lib/mockData.ts', 'utf8');
const lines = newCode.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('capacity:') && lines[i+1].includes('children: [')) {
     if (lines[i+1].includes('children: []')) {
        lines[i+1] = lines[i+1].replace('children: []', 'trips: [{ id: "trip-mock", tripIndex: 1, children: [] }]');
     } else {
        lines[i+1] = lines[i+1].replace('children: [', 'trips: [{ id: "trip-mock", tripIndex: 1, children: [').replace(')]', ')] }]');
     }
  }
}
fs.writeFileSync('lib/mockData.ts', lines.join('\n'));

console.log("MockData fixed");
