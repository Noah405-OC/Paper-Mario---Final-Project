const { sequelize } = require("./models");

(async () => {
  try {
    await sequelize.sync({ force: true }); // drops and recreates every table
    await sequelize.query(
      "ALTER TABLE pure_hearts ADD CONSTRAINT ck_heart_number_1_8 CHECK (heart_number BETWEEN 1 AND 8)"
    ); // CHECK
    console.log("All 17 tables created!");
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
})();