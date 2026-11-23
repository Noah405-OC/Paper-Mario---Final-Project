const { seedDatabase } = require("./seed");
const { sequelize } = require("./models");

if (require.main === module) {
  (async () => {
    try {
      await seedDatabase(true);
      console.log("All 17 tables created and seeded!");
    } catch (err) {
      console.error(err);
    } finally {
      await sequelize.close();
    }
  })();
}

module.exports = { initTables: seedDatabase };