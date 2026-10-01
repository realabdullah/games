import * as v from 'valibot';

export const TriviaQuestion = v.object({
	q: v.pipe(v.string(), v.trim(), v.minLength(3), v.maxLength(200)),
	choices: v.pipe(
		v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
		v.minLength(2),
		v.maxLength(4)
	),
	/** Index into `choices` of the right answer. */
	answer: v.pipe(v.number(), v.integer(), v.minValue(0)),
	/** Shown after the reveal. */
	fact: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(240)))
});

export const TriviaPack = v.pipe(
	v.object({
		id: v.pipe(v.string(), v.regex(/^[a-z0-9-]{2,40}$/)),
		title: v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(60)),
		description: v.pipe(v.string(), v.trim(), v.maxLength(160)),
		emoji: v.optional(v.string()),
		language: v.optional(v.string(), 'en'),
		questions: v.pipe(v.array(TriviaQuestion), v.minLength(3), v.maxLength(100))
	}),
	v.check(
		(p) => p.questions.every((q) => q.answer < q.choices.length),
		'Every answer must point at one of its choices'
	)
);

export type TriviaQuestion = v.InferOutput<typeof TriviaQuestion>;
export type TriviaPack = v.InferOutput<typeof TriviaPack>;
