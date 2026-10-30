/** Fixed root-owned helper: invoked only as the website account by narrow sudoers. */
import { createHash } from 'node:crypto';
import { readdirSync, lstatSync, openSync, readSync, closeSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
try {
  const root=process.argv[2];
  if(process.argv.length!==3||!isAbsolute(root)||lstatSync(root).isSymbolicLink())throw Error();
  const hash=createHash('sha256');
  function walk(dir,prefix='') {
    for(const name of readdirSync(dir).sort()){
      const path=join(dir,name),stat=lstatSync(path),relative=prefix+name;
      if(stat.isSymbolicLink())throw Error();
      if(stat.isDirectory())walk(path,relative+'/');
      else if(stat.isFile()){
        hash.update(relative+'\0');const file=createHash('sha256'),fd=openSync(path,'r'),buffer=Buffer.alloc(65536);
        try{let count;while((count=readSync(fd,buffer,0,buffer.length,null))>0)file.update(buffer.subarray(0,count));}finally{closeSync(fd);}
        hash.update(file.digest());
      }else throw Error();
    }
  }
  walk(root);process.stdout.write(hash.digest('hex')+'\n');
}catch{process.stderr.write('Media fingerprint unavailable.\n');process.exitCode=1;}
