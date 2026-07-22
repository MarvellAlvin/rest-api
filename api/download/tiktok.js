const { tiktokDownloader } = require('../../plugins/download/tiktok');

module.exports = async (req,res)=>{

    const startTime = Date.now();

    const { url, hd=false } =
        req.method==="GET"
        ? req.query
        : req.body;

    if(!url){

        return res.status(400).json({
            status:false,
            statusCode:400,
            author:"@velz",
            error:'Parameter "url" wajib diisi.',
            responseTimeMs:Date.now()-startTime,
            timestamp:new Date().toISOString()
        });

    }

    try{

        const result =
            await tiktokDownloader(
                url,
                { hd: hd==="true" || hd===true }
            );

        res.status(200).json({
            status:true,
            statusCode:200,
            author:"@velz",
            result,
            responseTimeMs:Date.now()-startTime,
            timestamp:new Date().toISOString()
        });

    }catch(err){

        res.status(500).json({
            status:false,
            statusCode:500,
            author:"@velz",
            error:err.message,
            responseTimeMs:Date.now()-startTime,
            timestamp:new Date().toISOString()
        });

    }

}
