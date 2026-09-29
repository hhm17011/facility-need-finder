// Optional integration check against the running app; not part of npm test.
// Credentials are loaded by the server, never sent from or printed by this script.
const response=await fetch('http://127.0.0.1:5173/api/regional-data/target-population?facility='+encodeURIComponent('어린이집'));
const data=await response.json();
if(!response.ok){console.error('KOSIS connection: FAILED; stage='+String(data.code??'REQUEST_ERROR'));process.exitCode=1;}
else{
 const valid=data.metrics.filter(m=>m.dataMode==='LIVE'&&m.verification==='source_verified'&&m.administrativeLevel==='SIGUNGU'&&Number.isFinite(m.value));
 if(!valid.length)throw Error('REGION NORMALIZATION ERROR: no usable SIGUNGU values');
 console.log(JSON.stringify({connection:'SUCCESS',table:valid[0].structuredSource.tableId,periods:data.periods,coverage:data.coverage,verifiedMetricCount:valid.length},null,2));
}
