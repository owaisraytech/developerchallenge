const { initializeDatabase } = require("./db");

initializeDatabase()
  .then(() => {
    console.log("Database seeded");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
