// Anthropic AI Coach API 호출 서비스
// (JOINTRUN_UNIFIED.jsx에서 분리됨)

async function callAnthropicCoach(messages, profile) {
  const systemPrompt = `당신은 JOINTRUN의 전문 관절 건강 AI 코치입니다. 손가락·손목 관절 건강을 전문으로 합니다.

현재 환자 정보:
- 이름: ${profile.name} (${profile.age}세, ${profile.gender})
- 직업: ${profile.job}
- 주요 증상: ${profile.symptoms}
- Finger Score™: ${profile.fingerHealthScore}/100점
- 아침 강직: ${profile.morningStiffness}
- 통증 VAS: ${profile.painIndex}/10

응답 규칙:
1. 친근하고 따뜻한 주치의 말투로 답하세요.
2. 환자의 직업과 증상에 맞게 구체적인 조언을 제공하세요.
3. 3분 온수 잼잼 요법, 스마트 보조기 활용, 생활 습관 개선을 권장하세요.
4. 의학적 진단을 내리지 말고, 전문의 상담을 권장하는 방향으로 안내하세요.
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
