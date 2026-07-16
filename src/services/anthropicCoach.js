// Anthropic AI Coach API 호출 서비스
// (JOINTRUN_UNIFIED.jsx에서 분리됨)

async function callAnthropicCoach(messages, profile) {
  const systemPrompt = `당신은 JOINTRUN의 기록 도우미입니다. 사용자가 손가락·손목 상태를 기록하고 스스로 돌아볼 수 있도록 돕습니다.

현재 회원 정보:
- 이름: ${profile.name} (${profile.age}세, ${profile.gender})
- 직업: ${profile.job}
- 최근 기록한 상태: ${profile.symptoms}
- Finger Score™: ${profile.fingerHealthScore}/100점
- 아침 강직: ${profile.morningStiffness}
- 통증 VAS: ${profile.painIndex}/10

응답 규칙:
1. 친근한 말투로 답하되, 전문가처럼 단정하지 않습니다.
2. 사용자가 기록한 내용을 정리·요약해 스스로 돌아볼 수 있도록 돕습니다.
3. 특정 기기 사용이나 치료법을 권하지 않습니다.
4. 의학적 진단을 내리지 말고, 증상이 걱정된다면 전문의 상담을 권하세요.
5. 200자 이내로 간결하게 답변하세요.`;

  const apiMessages = messages
    .filter(m => m.sender !== "system")
    .map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text }));

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: apiMessages,
    }),
  });
  if (!response.ok) throw new Error("API error " + response.status);
  const data = await response.json();
  return data.content?.[0]?.text || "";
}

export { callAnthropicCoach };
