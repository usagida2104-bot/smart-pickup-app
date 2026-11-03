export const getCellData = (raw: string) => {
  if (!raw) return { role: "フリー", attendance: "通常", time: "", endTime: "" };
  const parts = raw.split("|");
  let role = parts[0] || "フリー";
  let attendanceRaw = parts[1] || "通常";

  if (role === "休み" || role === "研修") {
    attendanceRaw = role;
    role = "フリー";
  }

  let attendance = attendanceRaw;
  let time = "";
  let endTime = "";

  const firstColon = attendanceRaw.indexOf(":");
  if (firstColon !== -1) {
    attendance = attendanceRaw.substring(0, firstColon);
    const timePart = attendanceRaw.substring(firstColon + 1);
    if (timePart.includes("-")) {
      const [t1, t2] = timePart.split("-");
      time = t1 || "";
      endTime = t2 || "";
    } else if (timePart.includes("~") || timePart.includes("〜")) {
      const [t1, t2] = timePart.split(/[~〜]/);
      time = t1 || "";
      endTime = t2 || "";
    } else {
      time = timePart;
    }
  }

  return { role, attendance, time, endTime };
};

export const packCellData = (role: string, attendance: string, time?: string, endTime?: string) => {
  let attStr = attendance;
  if (attendance === "遅刻" || attendance === "早退") {
    if (time) attStr = `${attendance}:${time}`;
  } else if (attendance === "中抜け" || attendance === "研修") {
    if (time && endTime) {
      attStr = `${attendance}:${time}-${endTime}`;
    } else if (time) {
      attStr = `${attendance}:${time}`;
    }
  }
  return `${role}|${attStr}`;
};

export const cleanTimeStr = (t?: string) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${(h || "00").padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
};

export const formatAttendanceBadge = (status: string, time?: string, endTime?: string) => {
  if (status === "早退" && time) return `早退 (〜${cleanTimeStr(time)})`;
  if (status === "遅刻" && time) return `遅刻 (${cleanTimeStr(time)}〜)`;
  if (status === "中抜け" && time && endTime) return `中抜け (${cleanTimeStr(time)}〜${cleanTimeStr(endTime)})`;
  if (status === "中抜け" && time) return `中抜け (${cleanTimeStr(time)})`;
  if (status === "研修" && time && endTime) return `研修 (${cleanTimeStr(time)}〜${cleanTimeStr(endTime)})`;
  if (status === "研修" && time) return `研修 (${cleanTimeStr(time)})`;
  return status;
};

export const getAttendanceDisplayParts = (status: string, time?: string, endTime?: string) => {
  if (status === "早退" && time) {
    return { main: "早退", sub: `〜${cleanTimeStr(time)}` };
  }
  if (status === "遅刻" && time) {
    return { main: "遅刻", sub: `${cleanTimeStr(time)}〜` };
  }
  if (status === "中抜け" && time) {
    return {
      main: "中抜け",
      sub: endTime ? `${cleanTimeStr(time)}〜${cleanTimeStr(endTime)}` : `${cleanTimeStr(time)}〜`,
    };
  }
  if (status === "研修" && time) {
    return {
      main: "研修",
      sub: endTime ? `${cleanTimeStr(time)}〜${cleanTimeStr(endTime)}` : `${cleanTimeStr(time)}〜`,
    };
  }
  return { main: status, sub: "" };
};

export function attendanceToStatus(attendance: string): "present" | "absent" | "late" | "early_leave" | "middle_leave" | "training" {
  switch (attendance) {
    case "休み": return "absent";
    case "遅刻": return "late";
    case "早退": return "early_leave";
    case "中抜け": return "middle_leave";
    case "研修": return "training";
    case "通常":
    default: return "present";
  }
}
