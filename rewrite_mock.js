const fs = require('fs');
let code = fs.readFileSync('lib/mockData.ts', 'utf8');

// Find the start of MOCK_WHITEBOARD_STATE
const startIndex = code.indexOf('export const MOCK_WHITEBOARD_STATE: BoardState = {');
if (startIndex !== -1) {
  code = code.substring(0, startIndex) + `export const MOCK_WHITEBOARD_STATE: BoardState = {
  columns: [
    {
      id: "shift-1", shiftId: "shift-1", vehicleId: "v-stepwgn", vehicleName: "ステップワゴン", driverId: "staff-1", driverName: "大平", capacity: 8,
      trips: [{ id: "shift-1-trip-1", tripIndex: 1, children: ["c-sato", "c-suzuki", "c-takahashi"].map(id => toMagnet(id)) }]
    },
    {
      id: "shift-2", shiftId: "shift-2", vehicleId: "v-voxy", vehicleName: "VOXY", driverId: "staff-2", driverName: "増田", capacity: 8,
      trips: [{ id: "shift-2-trip-1", tripIndex: 1, children: [] }]
    },
    {
      id: "shift-3", shiftId: "shift-3", vehicleId: "v-nvan", vehicleName: "Nバン", driverId: "staff-3", driverName: "熊田", capacity: 4,
      trips: [{ id: "shift-3-trip-1", tripIndex: 1, children: ["c-ito", "c-watanabe"].map(id => toMagnet(id)) }]
    },
    {
      id: "shift-4", shiftId: "shift-4", vehicleId: "v-isis", vehicleName: "アイシス", driverId: "staff-4", driverName: "つち", capacity: 7,
      trips: [{ id: "shift-4-trip-1", tripIndex: 1, children: ["c-yamamoto"].map(id => toMagnet(id)) }]
    },
    {
      id: "shift-5", shiftId: "shift-5", vehicleId: "v-spacia", vehicleName: "SPACIA", driverId: "staff-5", driverName: "大平", capacity: 4,
      trips: [{ id: "shift-5-trip-1", tripIndex: 1, children: ["c-kobayashi"].map(id => toMagnet(id)) }]
    },
    {
      id: "shift-6", shiftId: "shift-6", vehicleId: "v-boon", vehicleName: "BOON", driverId: "staff-6", driverName: "須田", capacity: 5,
      trips: [{ id: "shift-6-trip-1", tripIndex: 1, children: ["c-kato", "c-yoshida"].map(id => toMagnet(id)) }]
    },
    {
      id: "shift-7", shiftId: "shift-7", vehicleId: "v-sienta", vehicleName: "Sienta", driverId: "staff-7", driverName: "熊田", capacity: 7,
      trips: [{ id: "shift-7-trip-1", tripIndex: 1, children: ["c-yamada"].map(id => toMagnet(id)) }]
    },
    {
      id: "shift-8", shiftId: "shift-8", vehicleId: "v-note", vehicleName: "NOTE", driverId: "staff-8", driverName: "矢沢", capacity: 5,
      trips: [{ id: "shift-8-trip-1", tripIndex: 1, children: [] }]
    },
    {
      id: "shift-9", shiftId: "shift-9", vehicleId: "v-sienta", vehicleName: "Sienta", driverId: "staff-9", driverName: "班長", capacity: 7,
      trips: [{ id: "shift-9-trip-1", tripIndex: 1, children: [] }]
    },
    {
      id: "shift-10", shiftId: "shift-10", vehicleId: "v-every", vehicleName: "Every", driverId: "staff-10", driverName: "高宮", capacity: 4,
      trips: [{ id: "shift-10-trip-1", tripIndex: 1, children: [] }]
    }
  ],
  unassigned: {
    id: "unassigned",
    children: [] 
  }
};
`;

  fs.writeFileSync('lib/mockData.ts', code);
  console.log("Mock data correctly rewritten.");
} else {
  console.log("Could not find MOCK_WHITEBOARD_STATE");
}
