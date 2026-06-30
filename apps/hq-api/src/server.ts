import { createHqApp } from './app';

const port = Number(process.env.PORT || 4010);
const app = createHqApp();

app.listen(port, () => {
  console.log(`ReemTeam HQ listening on http://localhost:${port}`);
});
