import { seedDatabase } from "../src/lib/db/seed";
import { closeDb } from "../src/lib/db/index";

seedDatabase();
closeDb();
