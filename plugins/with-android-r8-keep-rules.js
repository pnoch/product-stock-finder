const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Room instantiates generated database implementations reflectively. Room's
// consumer rule keeps the class but not its constructor, so R8 strips the
// no-arg constructor and WorkManager crashes at startup. Re-applied on every
// `expo prebuild` because `android/` is gitignored.
const ROOM_KEEP_RULE = `
# Room instantiates generated database implementations reflectively. Room's
# consumer rule keeps the class but not its constructor, so R8 strips the
# no-arg constructor and WorkManager crashes at startup.
-keep class * extends androidx.room.RoomDatabase {
    <init>();
}
`;

module.exports = function withAndroidR8KeepRules(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const file = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "proguard-rules.pro",
      );
      let contents = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      if (!contents.includes("androidx.room.RoomDatabase")) {
        contents = `${contents.trimEnd()}\n${ROOM_KEEP_RULE}`;
        fs.writeFileSync(file, contents);
      }
      return cfg;
    },
  ]);
};
