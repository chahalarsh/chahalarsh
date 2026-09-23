export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: "Missing 'username' query param" });
  }

  const query = `
    query userProblemsSolved($username: String!) {
      matchedUser(username: $username) {
        username
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
  `;

  try {
    const lcRes = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": `https://leetcode.com/${username}/`,
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({ query, variables: { username } }),
    });

    if (!lcRes.ok) throw new Error(`LeetCode responded ${lcRes.status}`);

    const json = await lcRes.json();
    const user = json?.data?.matchedUser;
    if (!user) return res.status(404).json({ error: `User "${username}" not found` });

    const counts = Object.fromEntries(
      user.submitStatsGlobal.acSubmissionNum.map(d => [d.difficulty, d.count])
    );

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=59");
    return res.status(200).json({
      username: user.username,
      solvedProblem: counts.All || 0,
    });
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach LeetCode", detail: err.message });
  }
}