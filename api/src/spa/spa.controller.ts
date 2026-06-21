import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { resolveWebDistPath, resolveWebIndexPath } from './web-dist';

@Controller()
export class SpaController {
  @Get()
  root(@Res() res: Response) {
    res.redirect('/dashboard');
  }

  @Get(['dashboard', 'profiles', 'applications'])
  serveApp(@Res() res: Response) {
    const indexPath = resolveWebIndexPath();
    if (!indexPath) {
      res
        .status(503)
        .type('text/plain')
        .send(
          'Web dashboard is not built yet. Run "npm run build:web" from the project root, then restart the API.',
        );
      return;
    }

    res.sendFile(indexPath);
  }

  @Get('vite.svg')
  serveViteSvg(@Res() res: Response) {
    const assetPath = join(resolveWebDistPath(), 'vite.svg');
    res.sendFile(assetPath, (error) => {
      if (error) {
        res.status(404).end();
      }
    });
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
