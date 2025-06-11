// wipePricebook.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // <-- update this path if needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// List your pricebook collections here
const collections = [
  'services',
  'materials',
  'equipment',
  'categories', // Only if you want to wipe categories too
  // Add more if needed
];

async function deleteCollection(collName, batchSize = 500) {
  const collectionRef = db.collection(collName);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });

  function deleteQueryBatch(query, resolve, reject) {
    query.get()
      .then(snapshot => {
        if (snapshot.size === 0) {
          return resolve();
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        return batch.commit().then(() => {
          process.nextTick(() => {
            deleteQueryBatch(query, resolve, reject);
          });
        });
      })
      .catch(reject);
  }
}

async function wipeAll() {
  for (const coll of collections) {
    console.log(`Wiping collection: ${coll}`);
    await deleteCollection(coll);
    console.log(`Done: ${coll}`);
  }
  console.log('All specified pricebook collections wiped.');
  process.exit(0);
}

wipeAll().catch(err => {
  console.error('Error wiping collections:', err);
  process.exit(1);
}); 