import * as fs from "fs/promises";
import * as path from "path";
import { PARSERS } from "../lib/scrapers/registry";

const FIXTURES_DIR = path.join(__dirname, "../tests/fixtures/scrapers");

async function generateFixtures() {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });
  // Fixtures are committed and tests assert against them. Refetching live
  // pages silently rewrites that baseline, so overwriting requires --force.
  const force = process.argv.includes("--force");

  for (const parser of PARSERS) {
    console.log(`Generating fixture for ${parser.id}...`);
    try {
      const url = parser.buildSearchUrl("CRS804");
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      const html = await response.text();
      const filePath = path.join(FIXTURES_DIR, `${parser.id}.html`);
      if (!force) {
        try {
          await fs.access(filePath);
          console.log(`  Skipped ${filePath} (exists; pass --force to overwrite)`);
          continue;
        } catch {
          // no existing fixture — write it
        }
      }
      await fs.writeFile(filePath, html);
      console.log(`  Saved ${filePath} (${html.length} bytes)`);
    } catch (error) {
      console.error(`  Failed for ${parser.id}: ${error}`);
    }
  }

  console.log("Done!");
}

generateFixtures();
