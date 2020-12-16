import { generatePrettyReleaseMessage } from '../src/utils';

describe('github-release-util', () => {
  it('should correctly generate pretty release message', () => {
    const prevTag = 'v2.5.1';
    const targetTag = 'v2.6.0';
    const repoUrl = 'https://github.com/nrfcloud/github-release-util';
    type Payload = {
      prevTag: string,
      targetTag: string,
      repoUrl: string,
      commits: string,
    };

    const useCases: [Payload, string][] = [
      [{
        prevTag,
        targetTag,
        repoUrl,
        commits: `
        2020-12-16 - f9aafd7 - fix: fixed HUGE bug
        2020-12-16 - 9c77086 - 2.5.1-beta.1
        2020-12-16 - dcd843f - chore: rebuilt
        2020-12-16 - 3ce6a46 - 2.5.1-beta.0
        2020-12-16 - b68a230 - feat: made pretty default releaseMessages
        2020-12-16 - b68a234 - feat: did other thing
        2020-12-16 - b68a233 - feat: changed cli shorthand to github-release-util BREAKING CHANGE
`},
        `
Changelog: [${prevTag}...${targetTag}](${repoUrl}/compare/${prevTag}...${targetTag})

## FEATURES
* made pretty default releaseMessages (@2020-12-16 - [b68a230](${repoUrl}/commit/b68a230))
* did other thing (@2020-12-16 - [b68a234](${repoUrl}/commit/b68a234))

## BUG FIXES
* fixed HUGE bug (@2020-12-16 - [f9aafd7](${repoUrl}/commit/f9aafd7))

## BREAKING CHANGES
* changed cli shorthand to github-release-util BREAKING CHANGE (@2020-12-16 - [b68a233](${repoUrl}/commit/b68a233))
`
      ]
    ]

    useCases.forEach(([input, expected]) => {
      const actual = generatePrettyReleaseMessage(input.commits, input.repoUrl, input.targetTag, input.prevTag);
      expect(actual).toEqual(expected)
    });
  })
});