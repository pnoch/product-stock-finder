import { DistributorParser } from "./types";

import { server2uParser } from "./server2u";
import { linitxParser } from "./linitx";
import { interprojektParser } from "./interprojekt";
import { nasstoreParser } from "./nasstore";
import { aerialParser } from "./aerial";
import { mikrotikstoreParser } from "./mikrotikstore";
import { miroParser } from "./miro";
import { gearupParser } from "./gearup";
import { balticnetworksParser } from "./balticnetworks";
import { linktechsParser } from "./linktechs";
import { winncomParser } from "./winncom";
import { bhphotoParser } from "./bhphoto";
import { duxtelParser } from "./duxtel";
import { wispParser } from "./wisp";
import { pbtechParser } from "./pbtech";
import { gowifiParser } from "./gowifi";
import { geticParser } from "./getic";
import { megaParser } from "./mega";
import { hellascomParser } from "./hellascom";
import { rocnocParser } from "./rocnoc";
import { networkdevicesParser } from "./networkdevices";
import { flytecParser } from "./flytec";
import { mbsiwavParser } from "./mbsiwav";
import { multilinkParser } from "./multilink";
import { neobitsParser } from "./neobits";

export const PARSERS: DistributorParser[] = [
  server2uParser,
  linitxParser,
  interprojektParser,
  nasstoreParser,
  aerialParser,
  mikrotikstoreParser,
  miroParser,
  gearupParser,
  balticnetworksParser,
  linktechsParser,
  winncomParser,
  bhphotoParser,
  duxtelParser,
  wispParser,
  pbtechParser,
  gowifiParser,
  geticParser,
  megaParser,
  hellascomParser,
  rocnocParser,
  networkdevicesParser,
  flytecParser,
  mbsiwavParser,
  multilinkParser,
  neobitsParser,
];

export function getParserByDistributorId(
  distributorId: string,
): DistributorParser | undefined {
  return PARSERS.find((p) => p.id === distributorId);
}

export function getAllParserIds(): string[] {
  return PARSERS.map((p) => p.id);
}
