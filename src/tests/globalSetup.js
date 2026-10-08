const { DB } = require('../database/database.js');

module.exports = async () => {
  await DB.resetDatabase();
};
