import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { fetchDistances } from '@/lib/distanceMatrix';
import { autoAssignVehicles } from '@/lib/autoAssignVehicles';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    assignments: {
      type: Type.ARRAY,
      description: "各車両への児童割り当てリスト",
      items: {
        type: Type.OBJECT,
        properties: {
          shiftId: { type: Type.STRING, description: "割り当て先のシフトのid (例: shift-s-usami)" },
          vehicleId: { type: Type.STRING },
          childrenIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "割り当てた児童の child_id の配列" },
          routeInfo: { type: Type.STRING, description: "巡回ルートの説明 (例: 'ぽっけ → 日中一時' など)" },
          estimatedTime: { type: Type.INTEGER, description: "予想される総移動時間 (分)" },
        },
        required: ["shiftId", "childrenIds"]
      }
    },
    unassigned: {
      type: Type.ARRAY,
      description: "定員オーバー等で割り当てられなかった児童のIDリスト",
      items: { type: Type.STRING }
    }
  },
  required: ["assignments", "unassigned"]
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mode = "inbound", attendances, shifts } = body;

    if (!attendances || !shifts) {
      return NextResponse.json({ error: 'attendances and shifts are required' }, { status: 400 });
    }

    const systemInstruction = `あなたは放課後等デイサービスの送迎配車を最適化するAIアシスタントです。
以下のルールに従い、最適な配車グループを作成しJSON形式で返答してください。

【現在の送迎モード】
${mode === "inbound" ? "行き（迎え）: 各学校から児童を乗せ、事業所へ向かうルートを構築してください。" : "帰り（送り）: 事務所からみんな同時に出発し、効率的に各児童の自宅へ送るルートを構築してください。"}

【配車ルール】
1. **定員厳守**: 各車両には \`capacity\` の数までしか児童を乗せられません。超過した児童は \`unassigned\` リストに入れてください。
2. **配慮事項（notes/has_caution）の考慮**: 児童のメモ内容を解釈し、例えば「〇〇君と不仲」などの記載があれば同じ車両にしないようにしてください。
3. **エリア・時間の優先 & 移動時間の最小化**: ${mode === "inbound" ? "同じお迎え時間帯の児童をまとめた上で、各車両のスタート地点から各学校、そしてゴール地点までの移動時間が最短になるよう巡回ルートを構築してください。" : "出発地から各児童の自宅を回り、到着地までの移動時間が全体として最短になるよう巡回ルートを構築してください。近い自宅の児童は同じ車両にまとめてください。到着地（endAddress）が『ドライバー自宅』となっている車両は、最後の児童を送り届けた後にドライバーが直帰します。最後の児童からドライバー自宅までの移動ロスが最小になるよう順番を調整してください。"}
4. **平準化**: 稼働する複数の車両へ、できるだけ均等に人数を分散させてください。1台だけ満員になるのを避けてください。

入力データとして、今回の配車対象児童（attendances）、稼働車両リスト（shifts: startAddressとendAddressを含む）、および各拠点の移動時間マトリクス（distanceMatrix）を渡します。
対象児童の目的地（行きなら学校、帰りなら自宅）の情報が含まれています。
distanceMatrix が無い場合は距離を推測してください。
出力は指定されたJSONスキーマに厳密に従い、各車両の routeInfo（巡回ルート名、出発地・到着地も含む）と estimatedTime（移動時間・分）も算出して返答してください。`;

    const addressesToFetch = new Set<string>();
    
    attendances.forEach((a: any) => {
      let addr = null;
      if (mode === "inbound") {
        addr = a.child?.school?.address;
      } else {
        addr = a.child?.homeAddress;
      }
      
      if (addr && addr !== "未設定" && addr.trim() !== "") {
        addressesToFetch.add(addr);
      }
    });

    shifts.forEach((s: any) => {
      if (s.startAddress && s.startAddress.trim() !== "") addressesToFetch.add(s.startAddress);
      if (s.endAddress && s.endAddress.trim() !== "") addressesToFetch.add(s.endAddress);
    });

    const uniqueAddresses = Array.from(addressesToFetch);

    let distanceMatrix = null;
    try {
      distanceMatrix = await fetchDistances(uniqueAddresses);
    } catch (dmError) {
      console.error("Error during Google Maps Distance Matrix API call:", dmError);
      // フォールバック: distanceMatrix は null のまま進行
    }

    const prompt = `
【出席児童リスト】
${JSON.stringify(attendances, null, 2)}

【稼働車両リスト】
${JSON.stringify(shifts, null, 2)}

【学校間の移動時間マトリクス（分）】
${distanceMatrix ? JSON.stringify(distanceMatrix, null, 2) : "取得できませんでした（エリア情報を使ってください）"}
`;

    let result;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.2, // 決定論的な結果を優先
        }
      });

      if (!response.text) {
        throw new Error("No text response from Gemini");
      }

      // 堅牢なJSON抽出 (Markdownのバッククォート除去)
      let rawText = response.text.trim();
      if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      }

      result = JSON.parse(rawText);
    } catch (aiError: any) {
      console.error("Error during Gemini API call or JSON parsing:", aiError);
      console.warn("Falling back to standard rule-based assignment...");
      
      // 完全自動フォールバック処理 (標準ルールベース配車)
      const fallbackResult = autoAssignVehicles({ attendances, shifts });
      
      const assignments = fallbackResult.columns.map(col => ({
        shiftId: col.shiftId,
        vehicleId: col.vehicleId,
        childrenIds: col.children.map(c => c.childId),
        routeInfo: "標準ルール配車",
        estimatedTime: null
      }));
      const unassigned = fallbackResult.unassigned.map(c => c.childId);
      
      result = { assignments, unassigned };
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error in auto-assign route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
