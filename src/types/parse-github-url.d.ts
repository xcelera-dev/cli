declare module 'parse-github-url' {
  interface ParsedGithubUrl {
    owner: string
    name: string
    repo: string
    branch?: string
  }

  function parseGithubUrl(url: string): ParsedGithubUrl | null

  export default parseGithubUrl
}
