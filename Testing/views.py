# -*- coding: utf-8 -*-
from __future__ import division
import jieba
from django.shortcuts import render
import json
from django.http import JsonResponse
import urllib2
import json
from collections import Counter
from operator import itemgetter
import math 
import random
def testing(request):
	print "INININININININI"
	nameList = createnameList()
	requestJson = json.loads(request.body)
	print requestJson
	show_id = requestJson['show_id']
	# show_id = 'zfbd377c4a99711e3a705'
	show_name = requestJson['show_name']
	# show_name = '爱你不放手'
	print show_id
	print show_name
	innameList = False
	for item in nameList:
		if show_name.encode('utf-8')==item[1]:
			innameList = True
			show_fileID = item[0]
			break
	if innameList:
		recommandList = searchCluster(show_fileID)
	else:
		IDlist = getmovieID(show_id)
		parseComment(IDlist)
		normalize()
		recommandList = cosine3()
	print recommandList
	response_data = {}
	response_data['result'] = recommandList
	return JsonResponse(response_data)
	# return HttpResponse(json.dumps(response_data), mimetype="application/json")
# Create your views here.


def getmovieID(show_id):
	url = "https://openapi.youku.com/v2/shows/videos.json?client_id=49943e18670311ff&show_id="+show_id+"&count=100"
	handle = urllib2.urlopen(url)
	html = handle.read().encode('utf-8')
	json_data = json.loads(html)
	IDlist = []
	for item in json_data["videos"]:
		IDlist.append(item['id'])
	return IDlist
def parseComment(IDlist):
	allcomment = []
	totalLen = 0
	for ID in IDlist:
		url = "http://api.mobile.youku.com/videos/"+ID+"/comments?pid=69b81504767483cf&pz=50"
		handle = urllib2.urlopen(url)
		html = handle.read().encode('utf-8')
		json_data = json.loads(html)
		for item in json_data["results"]:
			if totalLen > 10000:
				break
			else:
				totalLen +=len(item["content"])
				allcomment.append(item["content"])
	writeFile = open('cusMovie.txt','w')
	for comment in allcomment:
		writeFile.write(comment.encode('utf-8'))
	writeFile.close()
	print 'parse done'
def normalize():
	tokenlist = tokenList('cusMovie.txt')
	cnt = Counter()
	writeFile = open('cusMovie_normal.txt','w')
	for word in tokenlist:
		cnt[word]+=1
	tfcnt = sorted(cnt.items(),key=itemgetter(0))
	tf_idfList = []
	dictionaryList = dictionaryList_from_file()
	for word in tfcnt:
		for dic in dictionaryList:
			if(word[0].encode('utf-8')==dic[0]):
				tf = word[1]
				tf_idf = tf*dic[2]
				tf_idfList.append((word[0],dic[1],tf_idf))	
				break
	sum = 0
	writeFile.write('term\t\tindex\t\ttf-idf\n')

	for word in tf_idfList:
		sum = sum+word[2]*word[2]
	totalsum = math.sqrt(sum)
	for word in tf_idfList:
		temp = word[2]/totalsum
		writeFile.write(word[0].encode('utf-8')+'\t\t'+str(word[1])+'\t\t'+str(temp)+'\n')
	print 'normal done'
	writeFile.close()

def tokenList(filename):
	commentfile = open(filename,'r')
	oriComment = commentfile.read()
	test = jieba.cut(oriComment)
	tokenList = []
	for word in test:
		if all(u'\u4e00' <= c <= u'\u9fff' for c in word) and len(word)>1:
			tokenList.append(word)
	return tokenList
def dictionaryList_from_file():
    dictionary = open('dictionary4.txt','r')
    dictionaryList = []
    dictionary.readline()
    for line in dictionary.readlines():
        line = line.strip('\n')
        tempAry = line.split('\t\t')
        df = int(tempAry[2])
        temp = 710/df
        idf  = math.log10(temp)
        tempturple = (tempAry[0],tempAry[1],idf)
        dictionaryList.append(tempturple)
    dictionary.close()
    return dictionaryList
def createnameList():
	nameFile = open('name.txt','r')
	nameList = []
	for line in nameFile.readlines():
		line = line.strip()
		tempAry = line.split('\t\t')
		tempturple = (tempAry[0],tempAry[1])
		nameList.append(tempturple)
	return nameList
def searchCluster(showid):
	HACFile = open('rr_output4_name.txt','r')
	isfound = False
	tempList = []
	for line in HACFile.readlines():
		line = line.strip()
		if len(line)==0:
			if isfound:
				break
			else:
				tempList = []
				continue
		else:
			tempAry = line.split('\t')
			if tempAry[0] == str(showid):
				isfound = True
				continue
			tempList.append(tempAry[1])
	rand_smpl = [ tempList[i] for i in sorted(random.sample(xrange(len(tempList)), 4)) ]
	# result_list = tempList[0:4]
	return rand_smpl
		
def cosine3():
	vfList = []
	for i in range(1,711):
		filename = "tfidfID3/"+str(i)+".txt"
		vf={}
		f1 = open(filename, 'r',)
		for line in f1:
			a=line.strip().split()
			vf[a[0]]=a[2]
		vf.pop('term', "tf-idf")
		vfList.append(vf)
	vf={}
	f1 = open('cusMovie_normal.txt', 'r')
	for line in f1:
		a=line.strip().split()
		vf[a[0]]=a[2]
	vf.pop('term', "tf-idf")
	vfList.append(vf)
	vf1 = vfList[710]
	tempmaxList = []
	maxList = []
	for i in range(1,710):
		vf2=vfList[i]
		intersection = set(vf1.keys()) & set(vf2.keys())
		numerator = sum([float(vf1[x] )* float(vf2[x]) for x in intersection])
		sum1 = sum([float(vf1[x])**2 for x in vf1.keys()])
		sum2 = sum([float (vf2[x])**2 for x in vf2.keys()])
		denominator = math.sqrt(sum1) * math.sqrt(sum2)
		cosine =  float(numerator) / denominator
		temptuple = (i,cosine)
		if len(tempmaxList)<4:
			tempmaxList.append(temptuple)
			tempmaxList.sort(key=lambda tup: tup[1],reverse=True)
		else:
			if tempmaxList[3][1] < cosine:
				tempmaxList[3] = temptuple
				tempmaxList.sort(key=lambda tup: tup[1],reverse=True)
	nameList = createnameList()
	for item in tempmaxList:
		for item2 in nameList:
			if str(item[0])==item2[0]:
				maxList.append(item2[1])
				break
	print 'cosine'
	return maxList

def stopword(Rlist):	
	stopwords=[]
	s = open("stopword.txt", 'r')
	for line in s.readlines():
		stopwords.append(line.replace("\n", "")) 
	s.close()
	result = [word for word in Rlist if word not in stopwords]
	return result
