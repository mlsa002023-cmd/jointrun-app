// Claude Design 토큰(RC1) space 스케일 [4,8,12,16,20,24,32,48,64,96] 그대로.
import tokens from "./tokens.json";

const [xs, sm, md, lg, xl, xxl, xxxl, xxxxl, huge, giant] = tokens.space;

export const spacing = { xs, sm, md, lg, xl, xxl, xxxl, xxxxl, huge, giant };
