# NEC_Crawler
NetEase Cartoon Crawler，manhua.163.com 爬虫<br>
<br>
最近迷上了漫画，还为了看漫画专门买了一个kpw3，用它看漫画感觉的确挺不错的，屏幕大了很多，看久了也不觉得伤眼睛<br>
由于之前在手机上一直是用网易漫画APP来看，比较习惯看上面的漫画了，于是就利用空余时间用NODE.JS写了个爬虫。<br>
<br>
![这是使用截图](https://github.com/tzwsoho/NEC_Crawler/raw/master/TIM%E6%88%AA%E5%9B%BE20180426153501.png)<br>
使用截图<br>
<br>
依赖库：<br>
npm install -g colors<br>
npm install -g mkdirp<br>
npm install -g get-pixels<br>
<br>
<br>
用法：<br>
<br>
1.在config.json里面设置好图书的：<br>
<br>
  a.BOOK_ID：就是漫画超链接里面的那串数字，爬取多本漫画就填多个，<br>
    如：https://manhua.163.com/source/5108295818580343008 里面的 5108295818580343008<br>
<br>
  b.output_dir：图片输出目录，漫画的不同章节会自动创建对应名称的目录<br>
<br>
2.VSCode直接运行，或直接在命令行下node app.js<br>
<br>
*******************************************************************************<br>
<br>
2019-01-04 更新日志：<br>
<br>
应网友YUIIUY要求增加了二维码扫描登录下载付费章节功能。感谢YUIIUY提供的测试账号！<br>
注意：如果在短时间内重复多次退出又登录，有可能会因为登录失败导致付费章节下载失败<br>
吐槽一下：网页版的163漫画登录方式有很多种，其中用户名账号登录方式的密码加密计算超级复杂，<br>
而且安全性和操作性也不高，所以在制作时没有采用这种方式<br>
而二维码方式由于客户端扫描成功率太低，很多微信能识别出来的二维码在使用163漫画客户端扫描时都死活没反应<br>
所以操作性也很低，大家先将就用着吧，期待163漫画的二维码扫描功能可以加强吧<br>
<br>
![将二维码置于扫描框中央能提高成功率](https://github.com/tzwsoho/NEC_Crawler/raw/master/qrCode_Scan.jpg)<br>
将二维码置于扫描框中央能提高成功率<br>