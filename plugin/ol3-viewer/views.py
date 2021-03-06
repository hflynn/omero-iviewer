#
# Copyright (c) 2017 University of Dundee.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#

from django.shortcuts import render
from django.http import JsonResponse
from django.core.urlresolvers import reverse
from django.http import HttpResponse
from omeroweb.decorators import login_required

import omero_marshal
from omero.model import MaskI


@login_required()
def index(request, iid=None, conn=None, **kwargs):
    return plugin_debug(request, iid=iid, conn=conn)


@login_required()
def plugin(request, iid=None, conn=None, debug=False, **kwargs):
    if iid is None:
        return HttpResponse("Viewer needs an image id!")
    params = {}
    for key in request.GET:
        if request.GET[key]:
            params[str(key).upper()] = str(request.GET[key])
    params['PLUGIN_PREFIX'] = reverse('ol3-viewer-index')

    return render(request, 'ol3-viewer/plugin.html',
                  {'image_id': iid, 'debug': debug, 'params': params})


@login_required()
def plugin_debug(request, iid=None, conn=None, **kwargs):
    return plugin(request, iid=iid, conn=conn, debug=True)


@login_required()
def request_rois(request, iid, conn=None, **kwargs):
    if iid is None:
        return JsonResponse({"error":
                            "no image id supplied for regions request"})

    roi_service = conn.getRoiService()
    if roi_service is None:
        return JsonResponse({"error":
                            "Could not get rois instance of roi service!"})

    ret = []
    try:
        result = roi_service.findByImage(long(iid), None, conn.SERVICE_OPTS)
        for roi in result.rois:
            rois_to_be_returned = {"@id": roi.getId().val, "shapes": []}
            for shape in roi.copyShapes():
                # masks not supported by marshal (would raise exception)
                if shape.__class__ == MaskI:
                    continue
                encoder = omero_marshal.get_encoder(shape.__class__)
                encoded_shape = encoder.encode(shape)
                if encoded_shape is None:
                    return JsonResponse({"error": "Failed to encode roi!"})
                rois_to_be_returned['shapes'].append(encoded_shape)
                ret.append(rois_to_be_returned)

        return JsonResponse(ret, safe=False)
    except Exception as someException:
        return JsonResponse({"error": repr(someException)})
