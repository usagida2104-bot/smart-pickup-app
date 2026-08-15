const fs = require('fs');
let code = fs.readFileSync('app/board/page.tsx', 'utf8');

code = code.replace('const syncBoard = (boardState: BoardState, mode: "inbound" | "outbound") => {', 'const syncBoard = (boardState: any, mode: "inbound" | "outbound") => {');
code = code.replace('state.setBoard(mode, { columns: newCols, unassigned: newUnassigned });', 'useBoardStore.getState().setBoard(mode, { columns: newCols, unassigned: newUnassigned });');
code = code.replace('syncBoard(state.inboundBoard, "inbound");', 'syncBoard(useBoardStore.getState().inboundBoard, "inbound");');
code = code.replace('syncBoard(state.outboundBoard, "outbound");', 'syncBoard(useBoardStore.getState().outboundBoard, "outbound");');

fs.writeFileSync('app/board/page.tsx', code);
console.log('Fixed page types');
