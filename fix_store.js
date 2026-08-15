const fs = require('fs');
let content = fs.readFileSync('lib/store/boardStore.ts', 'utf8');

const badPattern = `  setBoard: (mode, board) => set({ [mode === "inbound" ? "inboundBoard" : "outboundBoard"]: board }),`;

const goodPattern = `  setBoard: (mode, board) => {
    const migratedColumns = (board.columns || []).map(col => {
      if (!col.trips || col.trips.length === 0) {
        return {
          ...col,
          trips: [{
            id: \`\${col.shiftId || col.id}-trip-1\`,
            tripIndex: 1,
            children: col.children || []
          }]
        };
      }
      return col;
    });
    set({ [mode === "inbound" ? "inboundBoard" : "outboundBoard"]: { ...board, columns: migratedColumns } });
  },`;

if (content.includes(badPattern)) {
    content = content.replace(badPattern, goodPattern);
    fs.writeFileSync('lib/store/boardStore.ts', content);
    console.log("Migration added to boardStore");
} else {
    console.log("Pattern not found in boardStore");
}
