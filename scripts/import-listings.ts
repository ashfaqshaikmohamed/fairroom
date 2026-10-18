import {getDb, getAllListings} from '../src/server/db';
const db = await getDb();
console.log(`Loaded ${getAllListings(db).length} catalog records. Demo homes are fictional; broker snapshots are not live availability.`);
