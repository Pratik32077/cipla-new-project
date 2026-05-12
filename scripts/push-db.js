import { spawn } from "child_process";

const run = () => {
  const child = spawn("npx", ["drizzle-kit", "push", "--config", "./drizzle.config.ts"], {
    cwd: "lib/db",
    shell: true,
    stdio: ["pipe", "inherit", "inherit"]
  });

  child.stdin.on("error", (err) => {
    console.error("Stdin error:", err);
  });

  // Periodically send newlines
  const interval = setInterval(() => {
    try {
      child.stdin.write("\n");
    } catch (e) {
      // Ignore
    }
  }, 1000);

  child.on("exit", (code) => {
    clearInterval(interval);
    console.log(`Process exited with code ${code}`);
    process.exit(code || 0);
  });
};

run();
