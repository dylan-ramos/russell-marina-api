const databaseName = process.env.MONGO_INITDB_DATABASE;
const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;

if (!databaseName || !username || !password) {
  throw new Error('MONGO_INITDB_DATABASE, MONGO_APP_USERNAME et MONGO_APP_PASSWORD sont requis.');
}

const applicationDatabase = db.getSiblingDB(databaseName);
const roles = [{ role: 'readWrite', db: databaseName }];

if (applicationDatabase.getUser(username)) {
  applicationDatabase.updateUser(username, { pwd: password, roles });
  print(`Utilisateur applicatif MongoDB mis à jour dans ${databaseName}.`);
} else {
  applicationDatabase.createUser({ user: username, pwd: password, roles });
  print(`Utilisateur applicatif MongoDB créé dans ${databaseName}.`);
}
