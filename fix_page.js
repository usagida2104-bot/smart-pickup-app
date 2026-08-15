const fs = require('fs');
let code = fs.readFileSync('app/board/page.tsx', 'utf8');
const badText = `        }),const att = attendances.find(a => a.child_id === m.id);
                return { 
                  ...m, 
                  status: child?.status, 
                  status_time: child?.status_time, 
                  has_caution: child?.has_caution ?? false,
                  pickup_time: (att?.pickup_time && att.pickup_time.trim() !== "")
                    ? att.pickup_time
                    : (child?.default_dismissal_time && child.default_dismissal_time.trim() !== "")
                      ? child.default_dismissal_time
                      : (child?.school?.default_dismissal_time && child.school.default_dismissal_time.trim() !== "")
                        ? child.school.default_dismissal_time
                        : null
                };
              })
          };
        });`;
const goodText = `        });`;
code = code.replace(badText, goodText);
fs.writeFileSync('app/board/page.tsx', code);
console.log("Replaced!");
