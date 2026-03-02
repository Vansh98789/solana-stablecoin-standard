import { Command } from "commander";
import { initCommand } from "./commands/init";
import { mintCommand } from "./commands/mint";
import { burnCommand } from "./commands/burn";
import { freezeCommand, thawCommand } from "./commands/freeze";
import { pauseCommand, unpauseCommand } from "./commands/pause";
import { blacklistCommand } from "./commands/blacklist";
import { seizeCommand } from "./commands/seize";
import { statusCommand, supplyCommand } from "./commands/status";
import { configCommand } from "./commands/config";
import { auditLogCommand } from "./commands/audit";

const program = new Command();
program.name("sss-token").description("Solana Stablecoin Standard CLI").version("1.0.0");

program.addCommand(configCommand());
program.addCommand(initCommand());
program.addCommand(mintCommand());
program.addCommand(burnCommand());
program.addCommand(freezeCommand());
program.addCommand(thawCommand());
program.addCommand(pauseCommand());
program.addCommand(unpauseCommand());
program.addCommand(blacklistCommand());
program.addCommand(seizeCommand());
program.addCommand(statusCommand());
program.addCommand(supplyCommand());
program.addCommand(auditLogCommand());

program.parse(process.argv);