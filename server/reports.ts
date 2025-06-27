import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import type { Appointment, Service } from "../shared/schema";

export async function gerarRelatorioMensalXLSX(ags: Appointment[], selectedMonth: string, services: Service[], returnFilePath = false): Promise<string | Buffer> {
  const getLocal = (a: Appointment) => (services.find(s => s.id === a.serviceId)?.local || 'Não informado').toLowerCase();
  const locais = Array.from(new Set(ags.map(getLocal))) as string[];
  const agsPorLocal = Object.fromEntries(locais.map(local => [local, ags.filter(a => getLocal(a) === local)]));
  function getMetricaLocal(agsLocal: Appointment[]): { [key: string]: string | number } {
    const total = agsLocal.length;
    const faltaram = agsLocal.filter(a => a.clientShowedUp === false).length;
    const compareceram = agsLocal.filter(a => a.clientShowedUp === true).length;
    const primeiraVez = agsLocal.filter(a => a.isFirstTime === true).length;
    const retornantes = agsLocal.filter(a => a.isFirstTime === false).length;
    const valor = agsLocal.reduce((acc, a) => acc + (a.servicePrice || 0), 0) / 100;
    const percFaltaram = total ? (faltaram / total * 100).toFixed(1) + '%' : '0%';
    const percCompareceram = total ? (compareceram / total * 100).toFixed(1) + '%' : '0%';
    return {
      'Qtd. Agendamentos': total,
      'Soma dos Valores': valor,
      'Faltaram': faltaram,
      'Compareceram': compareceram,
      '% Faltaram': percFaltaram,
      '% Compareceram': percCompareceram,
      'Primeira vez': primeiraVez,
      'Retornantes': retornantes
    };
  }
  const resumoPorLocal = locais.map(local => {
    const agsLocal = agsPorLocal[local];
    return {
      [local.charAt(0).toUpperCase() + local.slice(1)]: getMetricaLocal(agsLocal)
    };
  });
  const totalObj = { TOTAL: getMetricaLocal(ags) };
  const allLocais = [...resumoPorLocal, totalObj];
  const metricaKeys = Object.keys(getMetricaLocal(ags));
  const header = ['Métrica', ...allLocais.map(obj => Object.keys(obj)[0])];
  const data = metricaKeys.map(key => [key, ...allLocais.map(obj => (Object.values(obj)[0] as any)[key])]);
  const wsResumo = XLSX.utils.aoa_to_sheet([header, ...data]);
  wsResumo['!cols'] = header.map(h => ({ wch: Math.max(h.length + 2, 18), alignment: { horizontal: 'right' } }));
  for (let R = 1; R <= data.length; ++R) {
    for (let C = 1; C < header.length; ++C) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C });
      if (wsResumo[cell]) wsResumo[cell].s = { alignment: { horizontal: 'right' } };
    }
  }
  const sheetsPorLocal = locais.map(local => {
    const agsLocal = agsPorLocal[local];
    const ws = XLSX.utils.json_to_sheet(agsLocal.map(a => ({
      Data: a.date,
      Horário: a.time,
      Cliente: a.clientName,
      Email: a.clientEmail,
      Telefone: a.clientPhone,
      Serviço: a.serviceName,
      Valor: (a.servicePrice / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      Observações: a.notes || ''
    })));
    ws['!cols'] = [
      { wch: 12 },
      { wch: 8 },
      { wch: 22 },
      { wch: 28 },
      { wch: 14 },
      { wch: 28 },
      { wch: 10 },
      { wch: 30 }
    ];
    return { name: local.charAt(0).toUpperCase() + local.slice(1), ws };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
  sheetsPorLocal.forEach(({ name, ws }) => XLSX.utils.book_append_sheet(wb, ws, name));
  const filePath = path.join("./tmp", `relatorio-agendamentos-${selectedMonth}.xlsx`);
  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp");
  XLSX.writeFile(wb, filePath);
  return filePath;
}

export async function gerarRelatorioAnualXLSX(ags: Appointment[], selectedYear: string, services: Service[], returnFilePath = false): Promise<string | Buffer> {
  const getLocal = (a: Appointment) => (services.find(s => s.id === a.serviceId)?.local || 'Não informado').toLowerCase();
  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const meses = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const locais = Array.from(new Set(ags.map(getLocal))) as string[];
  function getMetricaLocal(agsLocal: Appointment[]): { [key: string]: string | number } {
    const total = agsLocal.length;
    const faltaram = agsLocal.filter(a => a.clientShowedUp === false).length;
    const compareceram = agsLocal.filter(a => a.clientShowedUp === true).length;
    const primeiraVez = agsLocal.filter(a => a.isFirstTime === true).length;
    const retornantes = agsLocal.filter(a => a.isFirstTime === false).length;
    const valor = agsLocal.reduce((acc, a) => acc + (a.servicePrice || 0), 0) / 100;
    const percFaltaram = total ? (faltaram / total * 100).toFixed(1) + '%' : '0%';
    const percCompareceram = total ? (compareceram / total * 100).toFixed(1) + '%' : '0%';
    return {
      'Qtd. Agendamentos': total,
      'Soma dos Valores': valor,
      'Faltaram': faltaram,
      'Compareceram': compareceram,
      '% Faltaram': percFaltaram,
      '% Compareceram': percCompareceram,
      'Primeira vez': primeiraVez,
      'Retornantes': retornantes
    };
  }
  const metricaKeys = Object.keys(getMetricaLocal(ags));
  const header = ['Mês/Local', ...locais.map(local => local.charAt(0).toUpperCase() + local.slice(1)), 'TOTAL'];
  const data: any[][] = [];
  meses.forEach((mes, idx) => {
    metricaKeys.forEach((key, i) => {
      const row = [`${mesesNomes[idx]} - ${key}`];
      locais.forEach(local => {
        const agsLocalMes = ags.filter(a => getLocal(a) === local && a.date.slice(5,7) === mes);
        row.push((getMetricaLocal(agsLocalMes) as any)[key]);
      });
      const agsMes = ags.filter(a => a.date.slice(5,7) === mes);
      row.push((getMetricaLocal(agsMes) as any)[key]);
      data.push(row);
    });
    data.push(Array(header.length).fill(''));
  });
  const wsResumo = XLSX.utils.aoa_to_sheet([header, ...data]);
  wsResumo['!cols'] = header.map(h => ({ wch: Math.max(h.length + 4, 18), alignment: { horizontal: 'right' } }));
  for (let R = 1; R <= data.length; ++R) {
    for (let C = 1; C < header.length; ++C) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C });
      if (wsResumo[cell]) wsResumo[cell].s = { alignment: { horizontal: 'right' } };
    }
  }
  for (let C = 0; C < header.length; ++C) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: C });
    if (wsResumo[cell]) wsResumo[cell].s = { font: { bold: true }, alignment: { horizontal: 'center' } };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Anual');
  const filePath = path.join("./tmp", `relatorio-anual-${selectedYear}.xlsx`);
  if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp");
  XLSX.writeFile(wb, filePath);
  return filePath;
}
