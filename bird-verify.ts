import { BirdClient } from "@messagebird/sdk";

// Replace bk_xxxxxxxxx with your real Bird API key before running this file.
const bird = new BirdClient({ apiKey: "bk_xxxxxxxxx" });

const result = await bird.verify.verifications.check({
  to: { email: "erika@therepproject.org" },
  code: "123456",
});

console.log(result.success);
