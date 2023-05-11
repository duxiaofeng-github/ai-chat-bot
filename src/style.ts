import { css } from '@linaria/core';

export const globals = css`
  :global() {
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');

    /* ---------- body ---------- */

    body {
      height: 100%;
      width: 100%;
      margin: 0;
      font-family: Montserrat, sans-serif;
      display: flex;
      flex-direction: column;
    }

    #container {
      flex-grow: 1;
      padding: 30px;
      overflow: auto;
    }
  }
`;
