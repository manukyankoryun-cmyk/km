/* KM extended services — IPC bridge (renderer) */
(function(){
  'use strict';
  const N=window.kmNative;
  if(!N)return;

  window.kmServices={
    backup:{
      run:()=>N.backup&&N.backup.run(),
      list:()=>N.backup&&N.backup.list(),
      restore:(name)=>N.backup&&N.backup.restore(name)
    },
    audit:{
      append:(entry)=>N.audit&&N.audit.append(entry),
      list:(limit)=>N.audit&&N.audit.list(limit||100)
    },
    security:{
      get:()=>N.security&&N.security.get(),
      set:(cfg)=>N.security&&N.security.set(cfg),
      verify:(password)=>N.security&&N.security.verify(password)
    },
    export:{
      scheduleExcel:(payload)=>N.export&&N.export.scheduleExcel(payload),
      batchPrintPdf:(payload)=>N.export&&N.export.batchPrintPdf(payload)
    }
  };
})();
