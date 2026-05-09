const fs = require('fs');
const p = require('path');

function walk(d) {
  let r = [];
  fs.readdirSync(d).forEach(f => {
    const pf = p.join(d, f);
    if (fs.statSync(pf).isDirectory()) {
      r = r.concat(walk(pf));
    } else if (pf.endsWith('.tsx') || pf.endsWith('.ts')) {
      let c = fs.readFileSync(pf, 'utf8');
      if (c.includes('from "@/types"') || c.includes("from '@/types'")) {
        // Replace `import { Type1, Type2 } from '@/types'` with `import type { Type1, Type2 } from '@/types'`
        const updated = c.replace(/import \{([^}]+)\} from ["']@\/types["']/g, 'import type { $1 } from "@/types"');
        if (updated !== c) {
          fs.writeFileSync(pf, updated);
          console.log("Updated", pf);
        }
      }
    }
  });
  return r;
}

walk('src');
